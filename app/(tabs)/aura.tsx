import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  ActionSheetIOS,
  Image,
  Animated as RNAnimated,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import { useRouter } from "expo-router";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";
import { useIsWideWeb } from "@/components/WebContainer";
import { CraftCard } from "@/components/crafts/CraftCard";
import { CraftPreview } from "@/components/crafts/CraftPreview";
import { MessageActions } from "@/components/chat/MessageActions";
import { ThinkingIndicator, type ThinkingStep } from "@/components/chat/ThinkingIndicator";
import { MemoryNotification } from "@/components/chat/MemoryNotification";
import { ScrollToBottomButton } from "@/components/chat/ScrollToBottomButton";
import { EmptyState } from "@/components/chat/EmptyState";

const C = Colors.dark;

// ─── Text formatting ──────────────────────────────────────────────────────────

const ROTATING_PLACEHOLDERS = [
  "Plan my day...",
  "Turn this into tasks...",
  "Help me think this through...",
  "Summarize this...",
  "Help me decide...",
  "What should I focus on?",
  "Break this down for me...",
];

const QUICK_CHIPS: { label: string; mode: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Plan", mode: "chat", icon: "calendar-outline" },
  { label: "Summarize", mode: "chat", icon: "list-outline" },
  { label: "Brainstorm", mode: "brainstorm", icon: "bulb-outline" },
  { label: "Decide", mode: "decision", icon: "git-branch-outline" },
];

const DOMAIN_CONFIG: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  engineering: { color: C.domainEngineering, icon: "code-slash-outline", label: "Engineering" },
  marketing:   { color: C.domainMarketing,   icon: "megaphone-outline",  label: "Marketing" },
  product:     { color: C.domainProduct,     icon: "cube-outline",       label: "Product" },
  finance:     { color: C.domainFinance,     icon: "bar-chart-outline",  label: "Finance" },
  leadership:  { color: C.domainLeadership,  icon: "compass-outline",    label: "Leadership" },
  operations:  { color: C.domainOperations,  icon: "settings-outline",   label: "Operations" },
};

const DOMAIN_ORDER = ["engineering", "marketing", "product", "finance", "leadership", "operations"];

function formatAuraText(raw: string): string {
  return raw
    .replace(/\|\|\|DOCUMENT_REQUEST\|\|\|[\s\S]*$/, "")
    .replace(/\|\|\|CRAFT_REQUEST\|\|\|[\s\S]*$/, "")
    .replace(/\|\|\|ACTION_ITEMS\|\|\|[\s\S]*$/, "")
    .replace(/\|\|\|DOCUMENT_REQUEST[\s\S]*$/, "")
    .replace(/\|\|\|ACTION_ITEMS[\s\S]*$/, "")
    .replace(/^Confidence:\s*(High|Medium|Low)\s*(?:\([^)]*\))?\s*$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^(\s*)[-*•]\s+/gm, "$1→ ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function FormattedText({ text, style, isUser }: { text: string; style?: any; isUser?: boolean }) {
  const segments = text.split(/(\*\*[^*\n]+\*\*|→)/g);
  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        if (seg.startsWith("**") && seg.endsWith("**")) {
          return (
            <Text key={i} style={{ fontWeight: "700" as const }}>
              {seg.slice(2, -2)}
            </Text>
          );
        }
        if (seg === "→" && !isUser) {
          return (
            <Text key={i} style={{ fontWeight: "700" as const, color: C.accent }}>
              →
            </Text>
          );
        }
        return seg;
      })}
    </Text>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────

type ChatMode = "chat" | "research" | "decision" | "brainstorm" | "explain";
type ExplainLevel = "simple" | "normal" | "expert";
type Confidence = "High" | "Medium" | "Low";
type MessageType = "text" | "brief" | "memory-prompt" | "wrap-up";

type Citation = { url: string; title: string; snippet: string };

type BriefData = {
  reflection: string;
  pattern: string;
  action: string;
  period: string;
};

type ReplyTo = {
  id: string;
  content: string;
  role: "user" | "assistant";
};

type DocumentRequest = {
  type: "pdf" | "docx";
  title: string;
  filename: string;
  sections: { heading: string; content_markdown: string }[];
  tables?: { title: string; columns: string[]; rows: string[][] }[];
  sources?: { title: string; url: string }[];
};

type ActionItem = {
  type: "task" | "project" | "memory" | "decision";
  title: string;
  description: string;
  priority?: "high" | "medium" | "low";
};

type Attachment = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: MessageType;
  mode?: ChatMode;
  confidence?: Confidence;
  confidenceReason?: string;
  citations?: Citation[];
  isPrivate?: boolean;
  timestamp: number;
  briefData?: BriefData;
  replyTo?: ReplyTo;
  documentRequest?: DocumentRequest;
  attachments?: { name: string; type: string }[];
  actionItems?: ActionItem[];
  skillName?: string;
  skillAutoDetected?: boolean;
  craft?: { id: string; title: string; kind: string; downloadUrl?: string; content?: string; filename: string };
};

type MemoryItem = {
  id: string;
  text: string;
  category: string;
  confidence?: string;
  createdAt?: string;
};

type SkillSummaryUI = {
  id: string;
  name: string;
  domain: string;
  icon: string;
  description: string;
  chainsWith: string[];
  triggerKeywords: string[];
};

type DetectedSkillInfo = {
  primary: string | null;
  secondary: string | null;
  wasAutoDetected: boolean;
  skillName: string | null;
};

// ─── Storage Keys ──────────────────────────────────────────────────────────

const MESSAGES_KEY = "aura:messages";
const BRIEF_DATE_KEY = "aura:brief_date";
const CHAT_COUNT_KEY = "aura:chat_count";
const MEMORY_ASKED_KEY = "aura:memory_asked";
const DEVICE_ID_KEY = "aura:device_id";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSelectedSkillName(skillId: string, skillsByDomain: Record<string, SkillSummaryUI[]> | null): string {
  if (!skillsByDomain) return "Skill";
  for (const skills of Object.values(skillsByDomain)) {
    const found = skills.find((s) => s.id === skillId);
    if (found) return found.name;
  }
  return "Skill";
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function apiHeaders(deviceId: string) {
  return { "Content-Type": "application/json", "x-device-id": deviceId };
}

// ─── Confidence Badge ───────────────────────────────────────────────────────

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  High: "#10B981",
  Medium: "#F59E0B",
  Low: "#EF4444",
};

const CONFIDENCE_DESCRIPTIONS: Record<Confidence, string> = {
  High: "Well-established knowledge backed by multiple reputable sources.",
  Medium: "Contextual advice that is plausible but may vary by situation.",
  Low: "Limited certainty — unverified or depends on specific conditions.",
};

function ConfidenceBadge({ confidence, reason, onPress }: { confidence: Confidence; reason?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.confidenceBadge, { borderColor: CONFIDENCE_COLORS[confidence] + "44" }]}
    >
      <View style={[styles.confidenceDot, { backgroundColor: CONFIDENCE_COLORS[confidence] }]} />
      <Text style={[styles.confidenceText, { color: CONFIDENCE_COLORS[confidence] }]}>
        {confidence} confidence
      </Text>
    </Pressable>
  );
}

function ConfidencePopup({
  visible,
  confidence,
  reason,
  onClose,
}: {
  visible: boolean;
  confidence: Confidence;
  reason: string;
  onClose: () => void;
}) {
  const color = CONFIDENCE_COLORS[confidence];
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.confidenceOverlay} onPress={onClose}>
        <View style={styles.confidencePopup}>
          <View style={[styles.confidencePopupHeader, { borderBottomColor: color + "20" }]}>
            <View style={[styles.confidencePopupDot, { backgroundColor: color }]} />
            <Text style={[styles.confidencePopupLevel, { color }]}>
              {confidence} Confidence
            </Text>
          </View>
          <Text style={styles.confidencePopupDesc}>
            {CONFIDENCE_DESCRIPTIONS[confidence]}
          </Text>
          {reason ? (
            <View style={styles.confidencePopupReasonBox}>
              <Text style={styles.confidencePopupReasonLabel}>Why this level:</Text>
              <Text style={styles.confidencePopupReason}>{reason}</Text>
            </View>
          ) : null}
          <Text style={styles.confidencePopupHint}>Tap anywhere to dismiss</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Citations ──────────────────────────────────────────────────────────────

function CitationsList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <View style={styles.citationsWrap}>
      <Text style={styles.citationsLabel}>Sources</Text>
      {citations.map((c, i) => (
        <Pressable
          key={i}
          onPress={() => c.url && Linking.openURL(c.url)}
          style={styles.citationItem}
        >
          <Ionicons name="link-outline" size={11} color={C.accent} />
          <Text style={styles.citationText} numberOfLines={1}>{c.title || c.url}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Document Download Button ────────────────────────────────────────────────

function DocumentDownloadButton({ documentRequest, deviceId }: { documentRequest: DocumentRequest; deviceId: string }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/export", baseUrl);
      if (Platform.OS === "web") {
        const resp = await global.fetch(url.toString(), {
          method: "POST",
          headers: apiHeaders(deviceId),
          body: JSON.stringify(documentRequest),
        });
        if (resp.ok) {
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = documentRequest.filename || "aura-export.pdf";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }
      } else {
        const LegacyFS = await import("expo-file-system/legacy");
        const Sharing = await import("expo-sharing");
        const filename = documentRequest.filename || "aura-export.pdf";
        const fileUri = LegacyFS.documentDirectory + filename;
        const resp = await fetch(url.toString(), {
          method: "POST",
          headers: apiHeaders(deviceId),
          body: JSON.stringify(documentRequest),
        });
        if (resp.ok) {
          const arrayBuf = await resp.arrayBuffer();
          const base64 = btoa(
            String.fromCharCode(...new Uint8Array(arrayBuf))
          );
          await LegacyFS.writeAsStringAsync(fileUri, base64, {
            encoding: LegacyFS.EncodingType.Base64,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: "application/pdf",
              dialogTitle: documentRequest.title,
            });
          }
        }
      }
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Pressable style={styles.downloadBtn} onPress={handleDownload} disabled={downloading}>
      <Ionicons name={downloading ? "hourglass-outline" : "document-outline"} size={14} color="#fff" />
      <Text style={styles.downloadBtnText}>
        {downloading ? "Generating..." : `Download ${documentRequest.type?.toUpperCase() || "PDF"}`}
      </Text>
    </Pressable>
  );
}

// ─── Mode Badge ─────────────────────────────────────────────────────────────

const MODE_LABELS: Record<ChatMode, string> = {
  chat: "Chat",
  research: "Research",
  decision: "Decision",
  brainstorm: "Brainstorm",
  explain: "Explain",
};

const MODE_ICONS: Record<ChatMode, keyof typeof Ionicons.glyphMap> = {
  chat: "chatbubble-outline",
  research: "search-outline",
  decision: "git-branch-outline",
  brainstorm: "bulb-outline",
  explain: "school-outline",
};

function ModeBadge({ mode }: { mode: ChatMode }) {
  if (mode === "chat") return null;
  return (
    <View style={styles.modeBadge}>
      <Ionicons name={MODE_ICONS[mode]} size={10} color={C.accent} />
      <Text style={styles.modeBadgeText}>{MODE_LABELS[mode]}</Text>
    </View>
  );
}

// ─── Brief Card ─────────────────────────────────────────────────────────────

function BriefCard({ data }: { data: BriefData }) {
  const label =
    data.period === "morning"
      ? "Morning Clarity"
      : data.period === "afternoon"
      ? "Afternoon Check-in"
      : "Evening Reflection";

  return (
    <View style={styles.briefCard}>
      <View style={styles.briefHeader}>
        <View style={styles.briefBadge}>
          <View style={styles.briefBadgeDot} />
          <Text style={styles.briefBadgeText}>{label.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.briefRow}>
        <View style={styles.briefIconWrap}>
          <Ionicons name="eye-outline" size={14} color={C.accent} />
        </View>
        <Text style={styles.briefRowText}>{data.reflection}</Text>
      </View>
      <View style={styles.briefRow}>
        <View style={styles.briefIconWrap}>
          <Ionicons name="trending-up-outline" size={14} color="#06B6D4" />
        </View>
        <Text style={styles.briefRowText}>{data.pattern}</Text>
      </View>
      <View style={[styles.briefRow, styles.briefActionRow]}>
        <View style={[styles.briefIconWrap, styles.briefActionIcon]}>
          <Ionicons name="arrow-forward" size={12} color={C.background} />
        </View>
        <Text style={[styles.briefRowText, styles.briefActionText]}>{data.action}</Text>
      </View>
    </View>
  );
}

// ─── Memory Prompt Card ─────────────────────────────────────────────────────

function MemoryPromptCard({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <View style={styles.memoryPromptCard}>
      <Text style={styles.memoryPromptText}>
        Want me to remember your goals so I can help better over time?
      </Text>
      <View style={styles.memoryPromptButtons}>
        <Pressable style={styles.memoryPromptYes} onPress={onYes}>
          <Text style={styles.memoryPromptYesText}>Yes, remember</Text>
        </Pressable>
        <Pressable style={styles.memoryPromptNo} onPress={onNo}>
          <Text style={styles.memoryPromptNoText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Wrap-Up Card ────────────────────────────────────────────────────────────

const CLOSING_SIGNALS = [
  "thanks", "thank you", "got it", "that's all", "thats all",
  "that's it", "thats it", "all good", "perfect", "great thanks",
  "appreciate it", "cheers", "bye", "goodbye", "good night",
  "talk later", "ttyl", "ok thanks", "okay thanks", "will do",
  "sounds good", "noted", "makes sense",
];

function shouldShowWrapUp(messages: Message[], latestUserContent: string): boolean {
  const textMessages = messages.filter((m) => m.type === "text");
  if (textMessages.length < 8) return false;

  const alreadyHasWrapUp = messages.some((m) => m.type === "wrap-up");
  if (alreadyHasWrapUp) return false;

  const lower = latestUserContent.toLowerCase().trim();
  return CLOSING_SIGNALS.some((signal) => lower.includes(signal));
}

function WrapUpCard({
  onSummary,
  onSaveTasks,
  onSaveToProject,
}: {
  onSummary: () => void;
  onSaveTasks: () => void;
  onSaveToProject: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={wrapUpStyles.container}>
      <View style={wrapUpStyles.header}>
        <Ionicons name="flag-outline" size={14} color={C.accent} />
        <Text style={wrapUpStyles.headerText}>Conversation wrap-up</Text>
      </View>
      <Text style={wrapUpStyles.description}>
        Looks like we covered a lot. Want to capture anything before moving on?
      </Text>
      <View style={wrapUpStyles.actions}>
        <Pressable style={wrapUpStyles.actionBtn} onPress={onSummary}>
          <Ionicons name="document-text-outline" size={16} color={C.accent} />
          <Text style={wrapUpStyles.actionBtnText}>Summary</Text>
        </Pressable>
        <Pressable style={wrapUpStyles.actionBtn} onPress={onSaveTasks}>
          <Ionicons name="checkbox-outline" size={16} color={C.accent} />
          <Text style={wrapUpStyles.actionBtnText}>Save Tasks</Text>
        </Pressable>
        <Pressable style={wrapUpStyles.actionBtn} onPress={onSaveToProject}>
          <Ionicons name="folder-outline" size={16} color="#8B5CF6" />
          <Text style={[wrapUpStyles.actionBtnText, { color: "#8B5CF6" }]}>Save to Project</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const wrapUpStyles = StyleSheet.create({
  container: {
    backgroundColor: "#111820",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.accent + "30",
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.accent,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  actionBtnText: {
    fontSize: 12,
    color: C.accent,
    fontFamily: "Inter_500Medium",
  },
});

// ─── Action Item Card ────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  task: "checkbox-outline",
  project: "folder-outline",
  memory: "layers-outline",
  decision: "git-branch-outline",
};

const ACTION_COLORS: Record<string, string> = {
  task: C.accent,
  project: "#8B5CF6",
  memory: "#06B6D4",
  decision: "#F59E0B",
};

function ActionItemCards({
  items,
  deviceId,
  onDismiss,
}: {
  items: ActionItem[];
  deviceId: string;
  onDismiss: () => void;
}) {
  const [processing, setProcessing] = useState<number | null>(null);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  const handleAccept = async (item: ActionItem, index: number) => {
    setProcessing(index);
    try {
      const baseUrl = getApiUrl();
      if (item.type === "task") {
        const url = new URL("/api/tasks", baseUrl);
        await global.fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": deviceId },
          body: JSON.stringify({ title: item.title, description: item.description, priority: item.priority || "medium" }),
        });
      } else if (item.type === "project") {
        const url = new URL("/api/projects", baseUrl);
        await global.fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": deviceId },
          body: JSON.stringify({ name: item.title, description: item.description }),
        });
      } else if (item.type === "memory") {
        const url = new URL("/api/memories", baseUrl);
        await global.fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": deviceId },
          body: JSON.stringify({ text: item.title + ": " + item.description, category: "goal" }),
        });
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAccepted((prev) => new Set(prev).add(index));
    } catch (err) {
      console.error("Action accept error:", err);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={actionStyles.container}>
      <View style={actionStyles.header}>
        <Ionicons name="flash-outline" size={12} color={C.accent} />
        <Text style={actionStyles.headerText}>Suggested actions</Text>
        <Pressable onPress={onDismiss} hitSlop={8} style={actionStyles.dismissBtn}>
          <Ionicons name="close" size={14} color={C.textTertiary} />
        </Pressable>
      </View>
      {items.map((item, i) => {
        const isAccepted = accepted.has(i);
        const color = ACTION_COLORS[item.type] || C.accent;
        return (
          <View key={i} style={[actionStyles.card, isAccepted && actionStyles.cardAccepted]}>
            <View style={[actionStyles.iconWrap, { backgroundColor: color + "22" }]}>
              <Ionicons name={ACTION_ICONS[item.type] || "add-outline"} size={14} color={color} />
            </View>
            <View style={actionStyles.cardContent}>
              <Text style={actionStyles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={actionStyles.cardDesc} numberOfLines={1}>{item.description}</Text>
            </View>
            {isAccepted ? (
              <View style={actionStyles.acceptedBadge}>
                <Ionicons name="checkmark" size={12} color="#22C55E" />
              </View>
            ) : (
              <Pressable
                onPress={() => handleAccept(item, i)}
                disabled={processing === i}
                style={[actionStyles.addBtn, { backgroundColor: color + "22" }]}
              >
                {processing === i ? (
                  <ActivityIndicator size="small" color={color} />
                ) : (
                  <Ionicons name="add" size={14} color={color} />
                )}
              </Pressable>
            )}
          </View>
        );
      })}
    </Animated.View>
  );
}

const actionStyles = StyleSheet.create({
  container: {
    marginTop: 6,
    marginLeft: 29,
    maxWidth: "82%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  headerText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
    flex: 1,
  },
  dismissBtn: { padding: 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    gap: 8,
  },
  cardAccepted: { opacity: 0.6 },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1 },
  cardTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.text,
  },
  cardDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 1,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptedBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E22",
  },
});

// ─── Quick Action Chips ────────────────────────────────────────────────────────

function QuickChips({
  onChipPress,
  isPrivate,
  currentMode,
}: {
  onChipPress: (chip: typeof QUICK_CHIPS[0]) => void;
  isPrivate: boolean;
  currentMode: ChatMode;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={chipStyles.scrollView}
      contentContainerStyle={chipStyles.container}
    >
      {QUICK_CHIPS.map((chip) => {
        const isActive =
          (chip.mode === "private" && isPrivate) ||
          (chip.mode !== "chat" && chip.mode !== "private" && chip.mode === currentMode);
        return (
          <Pressable
            key={chip.label}
            style={[chipStyles.chip, isActive && chipStyles.chipActive]}
            onPress={() => onChipPress(chip)}
          >
            <Ionicons
              name={chip.icon}
              size={12}
              color={isActive ? C.accent : C.textSecondary}
            />
            <Text style={[chipStyles.chipText, isActive && chipStyles.chipTextActive]}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const chipStyles = StyleSheet.create({
  scrollView: { maxHeight: 36 },
  container: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    borderColor: C.accent,
    backgroundColor: C.accentGlow,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  chipTextActive: { color: C.accent },
});

// ─── Skill Badge (on assistant messages) ────────────────────────────────────

function SkillBadge({ skillName, wasAutoDetected }: { skillName: string; wasAutoDetected?: boolean }) {
  const isChained = skillName.includes("+");
  const primaryDomain = Object.keys(DOMAIN_CONFIG).find((d) =>
    skillName.toLowerCase().includes(DOMAIN_CONFIG[d].label.toLowerCase())
  );
  const dotColor = primaryDomain ? DOMAIN_CONFIG[primaryDomain].color : C.textTertiary;

  return (
    <View style={skillBadgeStyles.container}>
      <View style={[skillBadgeStyles.dot, { backgroundColor: dotColor }]} />
      {wasAutoDetected && <Text style={skillBadgeStyles.auto}>✦</Text>}
      <Text style={skillBadgeStyles.text} numberOfLines={1}>{skillName}</Text>
    </View>
  );
}

const skillBadgeStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
    paddingLeft: 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  auto: { fontSize: 10, color: C.accentWarm },
  text: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },
});

// ─── Skill Picker Sheet ─────────────────────────────────────────────────────

function SkillPickerSheet({
  visible,
  skillsByDomain,
  activeSkillId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  skillsByDomain: Record<string, SkillSummaryUI[]> | null;
  activeSkillId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={skillPickerStyles.overlay}>
        <Pressable style={skillPickerStyles.backdrop} onPress={onClose} />
        <View style={[skillPickerStyles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "70%" }]}>
          <View style={skillPickerStyles.handle} />
          <View style={skillPickerStyles.header}>
            <Text style={skillPickerStyles.title}>Choose expertise</Text>
            <Pressable onPress={onClose} style={skillPickerStyles.closeBtn}>
              <Ionicons name="close" size={20} color={C.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* General (Auto) option */}
            <Pressable
              style={[skillPickerStyles.skillOption, !activeSkillId && skillPickerStyles.skillOptionActive]}
              onPress={() => { onSelect(null); onClose(); }}
            >
              <View style={[skillPickerStyles.skillDot, { backgroundColor: C.accent }]} />
              <View style={skillPickerStyles.skillInfo}>
                <Text style={[skillPickerStyles.skillName, !activeSkillId && skillPickerStyles.skillNameActive]}>
                  General
                </Text>
                <Text style={skillPickerStyles.skillDesc}>Aura picks the right expertise automatically</Text>
              </View>
              {!activeSkillId && <Ionicons name="checkmark" size={16} color={C.accent} />}
            </Pressable>

            {/* Domain sections */}
            {skillsByDomain ? DOMAIN_ORDER.map((domain) => {
              const config = DOMAIN_CONFIG[domain];
              const skills = skillsByDomain[domain];
              if (!skills || skills.length === 0) return null;
              return (
                <View key={domain}>
                  <View style={skillPickerStyles.domainHeader}>
                    <Ionicons name={config.icon} size={14} color={config.color} />
                    <Text style={[skillPickerStyles.domainLabel, { color: config.color }]}>
                      {config.label}
                    </Text>
                  </View>
                  {skills.map((skill) => {
                    const isActive = activeSkillId === skill.id;
                    return (
                      <Pressable
                        key={skill.id}
                        style={[skillPickerStyles.skillOption, isActive && skillPickerStyles.skillOptionActive]}
                        onPress={() => { onSelect(skill.id); onClose(); }}
                      >
                        <View style={[skillPickerStyles.skillDot, { backgroundColor: config.color }]} />
                        <View style={skillPickerStyles.skillInfo}>
                          <Text style={[skillPickerStyles.skillName, isActive && skillPickerStyles.skillNameActive]}>
                            {skill.name}
                          </Text>
                          <Text style={skillPickerStyles.skillDesc} numberOfLines={1}>
                            {skill.description}
                          </Text>
                        </View>
                        {isActive && <Ionicons name="checkmark" size={16} color={C.accent} />}
                      </Pressable>
                    );
                  })}
                </View>
              );
            }) : (
              <View style={skillPickerStyles.loading}>
                <ActivityIndicator size="small" color={C.textTertiary} />
                <Text style={skillPickerStyles.loadingText}>Loading skills...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const skillPickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: Platform.OS === "web" ? "center" : "flex-end",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: C.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    ...(Platform.OS === "web" ? { borderRadius: 24, maxWidth: 420, width: "100%" } : {}),
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.surfaceTertiary,
    alignSelf: "center", marginBottom: 16,
  },
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 16,
  },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: C.text },
  closeBtn: { padding: 4 },
  domainHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 4,
    marginTop: 8,
  },
  domainLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  skillOption: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 2,
  },
  skillOptionActive: {
    backgroundColor: C.accent + "12",
    borderWidth: 1, borderColor: C.accent + "30",
  },
  skillDot: { width: 8, height: 8, borderRadius: 4 },
  skillInfo: { flex: 1 },
  skillName: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.text },
  skillNameActive: { color: C.accent },
  skillDesc: { fontSize: 12, color: C.textTertiary, fontFamily: "Inter_400Regular", marginTop: 1 },
  loading: { alignItems: "center", paddingVertical: 32, gap: 8 },
  loadingText: { fontSize: 13, color: C.textTertiary, fontFamily: "Inter_400Regular" },
});

// ─── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onMemoryYes,
  onMemoryNo,
  onReply,
  onWrapUpSummary,
  onWrapUpSaveTasks,
  onWrapUpSaveToProject,
  onConfidenceTap,
  onCraftPreview,
  onRegenerate,
  allMessages,
  deviceId,
}: {
  message: Message;
  onMemoryYes: () => void;
  onMemoryNo: () => void;
  onReply: (msg: Message) => void;
  onWrapUpSummary: () => void;
  onWrapUpSaveTasks: () => void;
  onWrapUpSaveToProject: () => void;
  onConfidenceTap: (confidence: Confidence, reason: string) => void;
  onCraftPreview: (craft: Message["craft"]) => void;
  onRegenerate: (userMessage: string) => void;
  allMessages: Message[];
  deviceId: string;
}) {
  const isUser = message.role === "user";

  if (message.type === "brief" && message.briefData) {
    return (
      <Animated.View entering={FadeIn.duration(600)}>
        <BriefCard data={message.briefData} />
      </Animated.View>
    );
  }

  if (message.type === "memory-prompt") {
    return (
      <Animated.View entering={FadeInDown.springify()}>
        <MemoryPromptCard onYes={onMemoryYes} onNo={onMemoryNo} />
      </Animated.View>
    );
  }

  if (message.type === "wrap-up") {
    return (
      <Animated.View entering={FadeInDown.springify()}>
        <WrapUpCard
          onSummary={onWrapUpSummary}
          onSaveTasks={onWrapUpSaveTasks}
          onSaveToProject={onWrapUpSaveToProject}
        />
      </Animated.View>
    );
  }

  const isResearch = message.mode && message.mode !== "chat";

  const replySource = message.replyTo
    ? allMessages.find((m) => m.id === message.replyTo!.id)
    : null;
  const replyPreviewText = message.replyTo
    ? (replySource?.content || message.replyTo.content).slice(0, 80)
    : null;

  return (
    <Animated.View
      entering={FadeInDown.duration(220).springify()}
      style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAgent]}
    >
      {!isUser && (
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarA}>A</Text>
        </View>
      )}
      <View style={styles.bubbleColumn}>
        {!isUser && message.skillName && (
          <SkillBadge skillName={message.skillName} wasAutoDetected={message.skillAutoDetected} />
        )}
        {!isUser && isResearch && message.mode && (
          <ModeBadge mode={message.mode} />
        )}
        {message.isPrivate && isUser && (
          <View style={styles.privateIndicator}>
            <Ionicons name="eye-off-outline" size={10} color={C.textTertiary} />
            <Text style={styles.privateText}>Private</Text>
          </View>
        )}

        {replyPreviewText && (
          <View style={[styles.replyPreviewInBubble, isUser && styles.replyPreviewInBubbleUser]}>
            <View style={[styles.replyBar, isUser && styles.replyBarUser]} />
            <Text
              style={[styles.replyPreviewInBubbleText, isUser && styles.replyPreviewInBubbleTextUser]}
              numberOfLines={2}
            >
              {formatAuraText(replyPreviewText)}
            </Text>
          </View>
        )}

        {isUser && message.attachments && message.attachments.length > 0 && (
          <View style={styles.attachmentBubbleList}>
            {message.attachments.map((att, i) => (
              <View key={i} style={styles.attachmentBubbleChip}>
                <Ionicons
                  name={att.type.startsWith("image/") ? "image-outline" : "document-outline"}
                  size={12}
                  color="rgba(255,255,255,0.8)"
                />
                <Text style={styles.attachmentBubbleText} numberOfLines={1}>{att.name}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent]}
        >
          <FormattedText
            text={isUser ? message.content : formatAuraText(message.content)}
            style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAgent]}
            isUser={isUser}
          />
        </Pressable>

        {!isUser && message.type === "text" && (
          <MessageActions
            messageText={message.content}
            messageId={message.id}
            deviceId={deviceId}
            onRegenerate={() => {
              // Find the user message that preceded this AI response
              const msgIndex = allMessages.findIndex((m) => m.id === message.id);
              if (msgIndex > 0) {
                const prevUserMsg = allMessages.slice(0, msgIndex).reverse().find((m) => m.role === "user");
                if (prevUserMsg) onRegenerate(prevUserMsg.content);
              }
            }}
          />
        )}

        {!isUser && message.confidence && (
          <ConfidenceBadge
            confidence={message.confidence}
            reason={message.confidenceReason}
            onPress={() => onConfidenceTap(message.confidence!, message.confidenceReason || "")}
          />
        )}
        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationsList citations={message.citations} />
        )}
        {!isUser && message.documentRequest && (
          <DocumentDownloadButton documentRequest={message.documentRequest} deviceId={deviceId} />
        )}
        {!isUser && message.actionItems && message.actionItems.length > 0 && (
          <ActionItemCards
            items={message.actionItems}
            deviceId={deviceId}
            onDismiss={() => {}}
          />
        )}
        {!isUser && message.craft && (
          <CraftCard
            craft={message.craft}
            onPreview={() => onCraftPreview(message.craft)}
            deviceId={deviceId}
          />
        )}
      </View>
    </Animated.View>
  );
}

// ─── Typing Dots ────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <View style={[styles.bubbleWrap, styles.bubbleWrapAgent]}>
      <View style={styles.avatarSmall}>
        <Text style={styles.avatarA}>A</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAgent, styles.typingBubble]}>
        <ActivityIndicator size="small" color={C.textTertiary} />
      </View>
    </View>
  );
}

// ─── Mode Picker Modal ──────────────────────────────────────────────────────

function ModePickerModal({
  visible,
  currentMode,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentMode: ChatMode;
  onSelect: (mode: ChatMode) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const modes: { mode: ChatMode; description: string }[] = [
    { mode: "chat", description: "Conversational, concise, thinking partner" },
    { mode: "research", description: "Evidence-first, citations, structured report" },
    { mode: "explain", description: "Feynman-style explanations, build up from simple" },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Mode</Text>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={C.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.modalSubtitle}>Choose how Aura should respond.</Text>
          <View style={styles.modeList}>
            {modes.map(({ mode, description }) => (
              <Pressable
                key={mode}
                style={[styles.modeOption, currentMode === mode && styles.modeOptionActive]}
                onPress={() => { onSelect(mode); onClose(); }}
              >
                <View style={[styles.modeOptionIcon, currentMode === mode && styles.modeOptionIconActive]}>
                  <Ionicons name={MODE_ICONS[mode]} size={18} color={currentMode === mode ? "#fff" : C.textSecondary} />
                </View>
                <View style={styles.modeOptionText}>
                  <Text style={[styles.modeOptionLabel, currentMode === mode && styles.modeOptionLabelActive]}>
                    {MODE_LABELS[mode]}
                  </Text>
                  <Text style={styles.modeOptionDesc}>{description}</Text>
                </View>
                {currentMode === mode && (
                  <Ionicons name="checkmark" size={16} color={C.accent} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Memory Modal ───────────────────────────────────────────────────────────

function MemoryModal({
  visible,
  memory,
  onClose,
  onDelete,
  onClearAll,
  onRefresh,
}: {
  visible: boolean;
  memory: MemoryItem[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onRefresh: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Memory</Text>
            <View style={styles.modalHeaderRight}>
              <Pressable onPress={onRefresh} style={styles.modalRefresh} hitSlop={8}>
                <Ionicons name="refresh-outline" size={18} color={C.textSecondary} />
              </Pressable>
              <Pressable onPress={onClose} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>
          </View>
          <Text style={styles.modalSubtitle}>
            What Aura remembers about you. Encrypted at rest. You control everything.
          </Text>

          {memory.length === 0 ? (
            <View style={styles.memoryEmpty}>
              <Ionicons name="leaf-outline" size={28} color={C.textTertiary} />
              <Text style={styles.memoryEmptyText}>
                Nothing remembered yet. Share your goals and Aura will learn.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.memoryList} showsVerticalScrollIndicator={false}>
              {memory.map((item) => (
                <View key={item.id} style={styles.memoryItem}>
                  <View style={styles.memoryItemLeft}>
                    <View style={styles.memoryItemMeta}>
                      <Text style={styles.memoryItemCategory}>{item.category}</Text>
                      {item.confidence && (
                        <View style={[styles.memoryConfidenceChip, {
                          backgroundColor: (CONFIDENCE_COLORS[item.confidence as Confidence] || "#888") + "22"
                        }]}>
                          <Text style={[styles.memoryConfidenceText, {
                            color: CONFIDENCE_COLORS[item.confidence as Confidence] || "#888"
                          }]}>{item.confidence}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.memoryItemText}>{item.text}</Text>
                  </View>
                  <Pressable
                    onPress={() => onDelete(item.id)}
                    style={styles.memoryDeleteBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color={C.textTertiary} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          {memory.length > 0 && (
            <Pressable onPress={onClearAll} style={styles.clearAllBtn}>
              <Ionicons name="trash-outline" size={14} color="#EF4444" />
              <Text style={styles.clearAllText}>Forget everything</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Chat Screen ───────────────────────────────────────────────────────

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingConfidence, setStreamingConfidence] = useState<Confidence | null>(null);
  const [streamingConfidenceReason, setStreamingConfidenceReason] = useState<string>("");
  const [showConfidencePopup, setShowConfidencePopup] = useState<{ confidence: Confidence; reason: string } | null>(null);
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [showModePicker, setShowModePicker] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [isLoadingBrief, setIsLoadingBrief] = useState(false);
  const [mode, setMode] = useState<ChatMode>("chat");
  const [explainLevel, setExplainLevel] = useState<ExplainLevel>("normal");
  const [isPrivate, setIsPrivate] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("anonymous");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [skillsByDomain, setSkillsByDomain] = useState<Record<string, SkillSummaryUI[]> | null>(null);
  const [detectedSkill, setDetectedSkill] = useState<DetectedSkillInfo | null>(null);
  const [previewCraft, setPreviewCraft] = useState<Message["craft"] | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [thinkingStep, setThinkingStep] = useState<ThinkingStep | null>(null);
  const [thinkingSources, setThinkingSources] = useState<string[]>([]);
  const [savedMemory, setSavedMemory] = useState<{ text: string; category: string } | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // ─── Orb Breathing Animation (always alive) ─────────────────────────
  const orbBreathe = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(orbBreathe, { toValue: 1, duration: 1500, useNativeDriver: true }),
        RNAnimated.timing(orbBreathe, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const orbBreatheScale = useMemo(() => orbBreathe.interpolate({
    inputRange: [0, 1], outputRange: [1, 1.02],
  }), []);

  // ─── Orb Thinking Animation (skill active) ─────────────────────────
  const orbPulse = useRef(new RNAnimated.Value(0)).current;
  const orbAnimRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const skillChipGlow = useRef(new RNAnimated.Value(0)).current;

  const isSkillThinking = isSending && !!activeSkillId;

  useEffect(() => {
    if (isSkillThinking) {
      const loop = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(orbPulse, { toValue: 1, duration: 900, useNativeDriver: false }),
          RNAnimated.timing(orbPulse, { toValue: 0, duration: 900, useNativeDriver: false }),
        ])
      );
      orbAnimRef.current = loop;
      loop.start();
    } else {
      orbAnimRef.current?.stop();
      RNAnimated.timing(orbPulse, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    }
    return () => { orbAnimRef.current?.stop(); };
  }, [isSkillThinking]);

  const orbColor = useMemo(() => orbPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [C.accent, C.accentWarm],
  }), []);

  const orbOpacity = useMemo(() => orbPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 1, 0.6],
  }), []);

  const orbScale = useMemo(() => orbPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.04, 1],
  }), []);

  // Flash skill chip amber on High confidence with active skill
  const flashSkillChipGlow = useCallback(() => {
    RNAnimated.sequence([
      RNAnimated.timing(skillChipGlow, { toValue: 1, duration: 100, useNativeDriver: false }),
      RNAnimated.timing(skillChipGlow, { toValue: 0, duration: 100, useNativeDriver: false }),
    ]).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const isWideWeb = useIsWideWeb();
  const topPadding = Platform.OS === "web" ? (isWideWeb ? 16 : 67) : insets.top;
  const bottomPadding = Platform.OS === "web" ? (isWideWeb ? 8 : 34) : insets.bottom;

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const id = await getDeviceId();
    setDeviceId(id);
    await loadData(id);
    // Fetch skills once — cached forever, never refetch
    try {
      const baseUrl = getApiUrl();
      const skillsUrl = new URL("/api/skills", baseUrl);
      const resp = await fetch(skillsUrl.toString(), { headers: apiHeaders(id) });
      if (resp.ok) {
        const data = await resp.json();
        setSkillsByDomain(data);
      }
    } catch (err) {
      console.warn("Skills fetch failed:", err);
    }
  };

  const loadData = async (devId: string) => {
    try {
      const storedMessages = await AsyncStorage.getItem(MESSAGES_KEY);
      let localMsgs: Message[] = storedMessages ? JSON.parse(storedMessages) : [];

      let serverMsgs: Message[] = [];
      if (devId !== "anonymous") {
        try {
          const baseUrl = getApiUrl();
          const url = new URL("/api/messages", baseUrl);
          const resp = await fetch(url.toString(), {
            headers: apiHeaders(devId),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
              serverMsgs = data
                .filter((m: any) => m.role && m.content)
                .map((m: any) => ({
                  id: m.id || generateId(),
                  role: m.role as "user" | "assistant",
                  content: String(m.content || ""),
                  type: "text" as MessageType,
                  mode: (m.mode || "chat") as ChatMode,
                  confidence: m.confidence || undefined,
                  timestamp: m.created_at
                    ? new Date(m.created_at).getTime()
                    : Date.now(),
                }));
            }
          }
        } catch {}
      }

      let msgs: Message[];
      if (serverMsgs.length > 0 && localMsgs.length > 0) {
        const serverIds = new Set(serverMsgs.map((m) => m.id));
        const localOnly = localMsgs.filter(
          (m) => !serverIds.has(m.id) && (m.type === "brief" || m.type === "memory-prompt")
        );
        msgs = [...serverMsgs, ...localOnly].sort((a, b) => a.timestamp - b.timestamp);
      } else if (serverMsgs.length > 0) {
        msgs = serverMsgs;
      } else {
        msgs = localMsgs;
      }

      if (msgs.length > 0) {
        await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
      }

      const briefDate = await AsyncStorage.getItem(BRIEF_DATE_KEY);
      const today = new Date().toDateString();

      if (briefDate !== today && msgs.length > 0) {
        setIsLoadingBrief(true);
        setMessages(msgs);
        const brief = await fetchBrief(devId, msgs);
        if (brief) {
          const briefMsg: Message = {
            id: generateId(),
            role: "assistant",
            content: "",
            type: "brief",
            timestamp: Date.now(),
            briefData: brief,
          };
          const updated = [...msgs, briefMsg];
          setMessages(updated);
          await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated));
        }
        await AsyncStorage.setItem(BRIEF_DATE_KEY, today);
        setIsLoadingBrief(false);
      } else if (msgs.length === 0) {
        const welcomeMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: "Hey. I'm Aura.\nI'm a truth-first thinking partner — I'll never guess when I don't know. What are you working through?",
          type: "text",
          mode: "chat",
          timestamp: Date.now(),
        };
        setMessages([welcomeMsg]);
        await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify([welcomeMsg]));
        await AsyncStorage.setItem(BRIEF_DATE_KEY, today);
      } else {
        setMessages(msgs);
      }

      await loadMemoryFromServer(devId);
    } catch (err) {
      console.error("loadData error:", err);
    }
  };

  const loadMemoryFromServer = async (devId: string) => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/memories", baseUrl);
      const res = await global.fetch(url.toString(), {
        headers: apiHeaders(devId),
      });
      if (res.ok) {
        const data = await res.json();
        setMemory(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore, memory is optional
    }
  };

  const fetchBrief = async (devId: string, msgs: Message[]): Promise<BriefData | null> => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/brief", baseUrl);
      const res = await global.fetch(url.toString(), {
        method: "POST",
        headers: apiHeaders(devId),
        body: JSON.stringify({
          recentMessages: msgs
            .filter((m) => m.type === "text")
            .slice(-8)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const saveMessages = async (msgs: Message[]) => {
    await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
  };

  const checkAndInjectMemoryPrompt = async (currentMessages: Message[]) => {
    const alreadyAsked = await AsyncStorage.getItem(MEMORY_ASKED_KEY);
    if (alreadyAsked) return currentMessages;

    const chatCount = await AsyncStorage.getItem(CHAT_COUNT_KEY);
    const count = chatCount ? parseInt(chatCount, 10) : 0;

    if (count === 2) {
      const promptMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: "memory-prompt",
        type: "memory-prompt",
        timestamp: Date.now(),
      };
      return [...currentMessages, promptMsg];
    }
    return currentMessages;
  };

  const handleMemoryYes = useCallback(async () => {
    await AsyncStorage.setItem(MEMORY_ASKED_KEY, "true");
    const confirmMsg: Message = {
      id: generateId(),
      role: "assistant",
      content: "Got it. I'll hold onto what matters — goals, patterns, context — and use it to be more useful. All stored encrypted. You can review or clear it anytime.",
      type: "text",
      mode: "chat",
      timestamp: Date.now(),
    };
    setMessages((prev) => {
      const filtered = prev.filter((m) => m.type !== "memory-prompt");
      const updated = [...filtered, confirmMsg];
      saveMessages(updated);
      return updated;
    });
  }, []);

  const handleMemoryNo = useCallback(async () => {
    await AsyncStorage.setItem(MEMORY_ASKED_KEY, "true");
    const confirmMsg: Message = {
      id: generateId(),
      role: "assistant",
      content: "No problem. Session-only for now — nothing stored. You can enable memory anytime.",
      type: "text",
      mode: "chat",
      timestamp: Date.now(),
    };
    setMessages((prev) => {
      const filtered = prev.filter((m) => m.type !== "memory-prompt");
      const updated = [...filtered, confirmMsg];
      saveMessages(updated);
      return updated;
    });
  }, []);

  const handleReply = useCallback((msg: Message) => {
    setReplyTo({ id: msg.id, content: msg.content, role: msg.role });
    inputRef.current?.focus();
  }, []);

  const pickFromCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      setAttachments((prev) => {
        if (prev.length >= 5) return prev;
        return [...prev, { uri: asset.uri, name, type: asset.mimeType || "image/jpeg", size: asset.fileSize }];
      });
    }
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets.length > 0) {
      setAttachments((prev) => {
        const remaining = 5 - prev.length;
        const newAtts = result.assets.slice(0, remaining).map((a) => ({
          uri: a.uri,
          name: a.fileName || `image_${Date.now()}.jpg`,
          type: a.mimeType || "image/jpeg",
          size: a.fileSize,
        }));
        return [...prev, ...newAtts];
      });
    }
  }, []);

  const pickFiles = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/csv",
        "application/json",
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    });
    if (!result.canceled && result.assets.length > 0) {
      setAttachments((prev) => {
        const remaining = 5 - prev.length;
        const newAtts = result.assets.slice(0, remaining).map((a) => ({
          uri: a.uri,
          name: a.name || "file",
          type: a.mimeType || "application/octet-stream",
          size: a.size ?? undefined,
        }));
        return [...prev, ...newAtts];
      });
    }
  }, []);

  const showAttachmentPicker = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Photo Library", "Browse Files"],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) pickFromCamera();
          else if (index === 2) pickFromLibrary();
          else if (index === 3) pickFiles();
        }
      );
    } else {
      Alert.alert("Attach", "Choose an option", [
        { text: "Take Photo", onPress: pickFromCamera },
        { text: "Photo Library", onPress: pickFromLibrary },
        { text: "Browse Files", onPress: pickFiles },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [pickFromCamera, pickFromLibrary, pickFiles]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isSending) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const currentReplyTo = replyTo;
    const currentAttachments = [...attachments];
    setInput("");
    setReplyTo(null);
    setAttachments([]);
    setIsSending(true);
    setStreamingText("");
    setStreamingConfidence(null);
    setStreamingConfidenceReason("");
    setStreamingCitations([]);

    const messageContent = text || (currentAttachments.length > 0 ? "Analyze the attached file(s)" : "");

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: messageContent,
      type: "text",
      mode,
      isPrivate,
      timestamp: Date.now(),
      replyTo: currentReplyTo ?? undefined,
      attachments: currentAttachments.length > 0
        ? currentAttachments.map((a) => ({ name: a.name, type: a.type }))
        : undefined,
    };

    const prevMessages = messages.filter((m) => m.type !== "memory-prompt");
    const currentMessages = [...prevMessages, userMsg];

    const chatCount = await AsyncStorage.getItem(CHAT_COUNT_KEY);
    const count = (chatCount ? parseInt(chatCount, 10) : 0) + 1;
    await AsyncStorage.setItem(CHAT_COUNT_KEY, count.toString());

    const withPrompt = await checkAndInjectMemoryPrompt(currentMessages);
    setMessages(withPrompt);
    if (!isPrivate) await saveMessages(withPrompt);

    try {
      const MAX_HISTORY_MESSAGES = 20;
      const filteredMessages = isPrivate
        ? [userMsg]
        : currentMessages
            .filter((m) => m.type === "text" && !m.isPrivate);
      const recentMessages = filteredMessages.slice(-MAX_HISTORY_MESSAGES);
      const conversationHistory = recentMessages
        .map((m) => {
          let content = m.content;
          if (m.replyTo) {
            const replyLabel = m.replyTo.role === "user" ? "my earlier message" : "your earlier response";
            const snippet = m.replyTo.content.slice(0, 200);
            content = `[Replying to ${replyLabel}: "${snippet}"]\n\n${m.content}`;
          }
          return { role: m.role, content };
        });

      const baseUrl = getApiUrl();
      const url = new URL("/api/chat", baseUrl);

      let response: Response;
      if (currentAttachments.length > 0) {
        const formData = new FormData();
        formData.append("messages", JSON.stringify(conversationHistory));
        formData.append("mode", mode);
        formData.append("explainLevel", explainLevel);
        formData.append("isPrivate", String(isPrivate));
        formData.append("rememberFlag", String(!isPrivate));
        formData.append("autoDetectMode", "false");
        if (activeSkillId) formData.append("activeSkillId", activeSkillId);
        if (currentConversationId) formData.append("conversationId", currentConversationId);

        for (const att of currentAttachments) {
          const fileObj = {
            uri: att.uri,
            name: att.name,
            type: att.type,
          } as any;
          formData.append("attachments", fileObj);
        }

        response = await fetch(url.toString(), {
          method: "POST",
          headers: { "x-device-id": deviceId, Accept: "text/event-stream" },
          body: formData as any,
        });
      } else {
        response = await fetch(url.toString(), {
          method: "POST",
          headers: { ...apiHeaders(deviceId), Accept: "text/event-stream" },
          body: JSON.stringify({
            messages: conversationHistory,
            mode,
            explainLevel,
            isPrivate,
            rememberFlag: !isPrivate,
            autoDetectMode: false,
            ...(activeSkillId ? { activeSkillId } : {}),
            ...(currentConversationId ? { conversationId: currentConversationId } : {}),
          }),
        });
      }

      if (!response.ok) throw new Error("Request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let finalConfidence: Confidence | null = null;
      let finalConfidenceReason = "";
      let finalCitations: Citation[] = [];
      let finalDocRequest: DocumentRequest | null = null;
      let finalActionItems: ActionItem[] = [];
      let finalCraft: Message["craft"] | undefined;
      let finalSkillName: string | undefined;
      let finalSkillAutoDetected: boolean | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "conversation_title" && parsed.conversationId) {
              setCurrentConversationId(parsed.conversationId);
            } else if (parsed.type === "memory_saved" && parsed.memories?.length > 0) {
              setSavedMemory({ text: parsed.memories[0].text, category: parsed.memories[0].category });
            } else if (parsed.type === "status") {
              setThinkingStep(parsed.step as ThinkingStep);
              if (parsed.sources) setThinkingSources(parsed.sources);
            } else if (parsed.type === "skill_active") {
              finalSkillName = parsed.skillName || undefined;
              finalSkillAutoDetected = parsed.wasAutoDetected ?? undefined;
              setDetectedSkill({
                primary: parsed.primary || null,
                secondary: parsed.secondary || null,
                wasAutoDetected: parsed.wasAutoDetected ?? false,
                skillName: parsed.skillName || null,
              });
            } else if (parsed.type === "confidence") {
              finalConfidence = parsed.confidence;
              finalConfidenceReason = parsed.confidenceReason || "";
              setStreamingConfidence(parsed.confidence);
              setStreamingConfidenceReason(parsed.confidenceReason || "");
              if (parsed.detectedSkill) {
                finalSkillName = parsed.detectedSkill.skillName || undefined;
                finalSkillAutoDetected = parsed.detectedSkill.wasAutoDetected ?? undefined;
              }
            } else if (parsed.type === "citations") {
              finalCitations = parsed.citations || [];
              setStreamingCitations(parsed.citations || []);
            } else if (parsed.type === "document_request") {
              finalDocRequest = parsed.documentRequest || null;
            } else if (parsed.type === "action_items") {
              finalActionItems = parsed.actionItems || [];
            } else if (parsed.type === "craft" && parsed.craft) {
              finalCraft = {
                id: parsed.craft.id,
                title: parsed.craft.title,
                kind: parsed.craft.kind,
                downloadUrl: parsed.downloadUrl,
                content: parsed.content,
                filename: parsed.craft.filename,
              };
            } else if (parsed.content) {
              if (!fullContent) { setThinkingStep(null); setThinkingSources([]); }
              fullContent += parsed.content;
              const displayContent = fullContent
                .replace(/\|\|\|DOCUMENT_REQUEST\|\|\|[\s\S]*$/, "")
    .replace(/\|\|\|CRAFT_REQUEST\|\|\|[\s\S]*$/, "")
                .replace(/\|\|\|ACTION_ITEMS\|\|\|[\s\S]*$/, "")
                .replace(/\|\|\|DOCUMENT_REQUEST[\s\S]*$/, "")
                .replace(/\|\|\|ACTION_ITEMS[\s\S]*$/, "")
                .replace(/\|{1,3}$/, "")
                .replace(/^Confidence:\s*(High|Medium|Low)\s*(?:\([^)]*\))?\s*$/gm, "");
              setStreamingText(displayContent);
            }
          } catch {}
        }
      }

      const cleanedContent = fullContent
        .replace(/\|\|\|DOCUMENT_REQUEST\|\|\|[\s\S]*$/, "")
    .replace(/\|\|\|CRAFT_REQUEST\|\|\|[\s\S]*$/, "")
        .replace(/\|\|\|ACTION_ITEMS\|\|\|[\s\S]*$/, "")
        .trim();
      const assistantMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: cleanedContent,
        type: "text",
        mode,
        confidence: finalConfidence ?? undefined,
        confidenceReason: finalConfidenceReason || undefined,
        citations: finalCitations.length > 0 ? finalCitations : undefined,
        documentRequest: finalDocRequest ?? undefined,
        actionItems: finalActionItems.length > 0 ? finalActionItems : undefined,
        skillName: finalSkillName,
        skillAutoDetected: finalSkillAutoDetected,
        craft: finalCraft,
        timestamp: Date.now(),
      };

      // Flash skill chip on High confidence + active skill
      if (finalConfidence === "High" && (activeSkillId || finalSkillName)) {
        flashSkillChipGlow();
      }

      setMessages((latest) => {
        const withoutPrompt = latest.filter((m) => m.type !== "memory-prompt");
        const updated = [...withoutPrompt, assistantMsg];

        AsyncStorage.getItem(CHAT_COUNT_KEY).then(async (cc) => {
          const c = cc ? parseInt(cc, 10) : 0;
          const asked = await AsyncStorage.getItem(MEMORY_ASKED_KEY);
          let finalMsgs = updated;
          if (c === 3 && !asked) {
            const promptMsg: Message = {
              id: generateId(),
              role: "assistant",
              content: "memory-prompt",
              type: "memory-prompt",
              timestamp: Date.now() + 1,
            };
            finalMsgs = [...updated, promptMsg];
          }

          if (shouldShowWrapUp(finalMsgs, messageContent)) {
            const wrapUpMsg: Message = {
              id: generateId(),
              role: "assistant",
              content: "wrap-up",
              type: "wrap-up",
              timestamp: Date.now() + 2,
            };
            finalMsgs = [...finalMsgs, wrapUpMsg];
          }

          if (!isPrivate) saveMessages(finalMsgs);
          setMessages(finalMsgs);
        });

        return updated;
      });

      setStreamingText("");
      setStreamingConfidence(null);
      setStreamingConfidenceReason("");
      setStreamingCitations([]);

      if (!isPrivate) {
        loadMemoryFromServer(deviceId);
      }

      inputRef.current?.focus();
    } catch (err) {
      console.error("Send error:", err);
      const errMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: "\u21BB Connection issue \u2014 tap to retry",
        type: "text",
        mode: "chat",
        timestamp: Date.now(),
      };
      setMessages((prev) => {
        const updated = [...prev.filter((m) => m.type !== "memory-prompt"), errMsg];
        saveMessages(updated);
        return updated;
      });
      setStreamingText("");
    } finally {
      setIsSending(false);
      setThinkingStep(null);
      setThinkingSources([]);
    }
  }, [input, isSending, messages, memory, mode, explainLevel, isPrivate, deviceId, replyTo, attachments]);

  const pendingSendRef = useRef<string | null>(null);

  useEffect(() => {
    if (pendingSendRef.current && input === pendingSendRef.current && !isSending) {
      pendingSendRef.current = null;
      sendMessage();
    }
  }, [input, isSending, sendMessage]);

  const triggerWrapUpAction = useCallback((text: string) => {
    setMessages((prev) => prev.filter((m) => m.type !== "wrap-up"));
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pendingSendRef.current = text;
    setInput(text);
  }, []);

  const handleWrapUpSummary = useCallback(() => {
    triggerWrapUpAction("Summarize our conversation");
  }, [triggerWrapUpAction]);

  const handleWrapUpSaveTasks = useCallback(() => {
    triggerWrapUpAction("Extract all tasks and action items from our conversation and list them clearly");
  }, [triggerWrapUpAction]);

  const handleWrapUpSaveToProject = useCallback(async () => {
    setMessages((prev) => prev.filter((m) => m.type !== "wrap-up"));
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let prompt = "Create a new project from our conversation with a summary and relevant tasks";
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/projects", baseUrl);
      const resp = await global.fetch(url.toString(), { headers: apiHeaders(deviceId) });
      if (resp.ok) {
        const projects = await resp.json();
        if (Array.isArray(projects) && projects.length > 0) {
          const projectName = projects[0].name;
          prompt = `Save key insights from our conversation to the project "${projectName}". Also create any relevant tasks.`;
        }
      }
    } catch {}
    pendingSendRef.current = prompt;
    setInput(prompt);
  }, [deviceId]);

  const deleteMemoryItem = useCallback(async (id: string) => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/memories/${id}`, baseUrl);
      await global.fetch(url.toString(), {
        method: "DELETE",
        headers: apiHeaders(deviceId),
      });
      setMemory((prev) => prev.filter((m) => m.id !== id));
    } catch {}
  }, [deviceId]);

  const clearAllMemory = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/memories", baseUrl);
      await global.fetch(url.toString(), {
        method: "DELETE",
        headers: apiHeaders(deviceId),
      });
      setMemory([]);
    } catch {}
  }, [deviceId]);

  const cycleExplainLevel = useCallback(() => {
    setExplainLevel((prev) =>
      prev === "simple" ? "normal" : prev === "normal" ? "expert" : "simple"
    );
  }, []);

  const streamingMessage: Message | null = streamingText
    ? {
        id: "streaming",
        role: "assistant",
        content: streamingText,
        type: "text",
        mode,
        confidence: streamingConfidence ?? undefined,
        confidenceReason: streamingConfidenceReason || undefined,
        citations: streamingCitations.length > 0 ? streamingCitations : undefined,
        timestamp: Date.now(),
      }
    : null;

  const displayMessages: Message[] = streamingMessage
    ? [...messages, streamingMessage].reverse()
    : [...messages].reverse();

  const showTyping = isSending && !streamingText;

  const EXPLAIN_LABELS: Record<ExplainLevel, string> = {
    simple: "Simple",
    normal: "Normal",
    expert: "Expert",
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header — stays fixed, outside KeyboardAvoidingView */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <RNAnimated.View style={[
            styles.headerAvatar,
            {
              transform: [{ scale: isSkillThinking ? orbScale : orbBreatheScale }],
            },
            isSkillThinking && { borderColor: orbColor },
          ]}>
            <RNAnimated.View style={[
              styles.headerAvatarMiddle,
              isSkillThinking && { borderColor: orbColor },
            ]}>
              <RNAnimated.View style={[
                styles.headerAvatarCore,
                isSkillThinking
                  ? { backgroundColor: orbColor, shadowColor: orbColor, opacity: orbOpacity }
                  : {},
              ]} />
            </RNAnimated.View>
          </RNAnimated.View>
          <View>
            <Text style={styles.headerTitle}>Aura</Text>
            <View style={styles.headerStatusRow}>
              <View style={styles.headerOnlineDot} />
              <Text style={styles.headerStatus}>truth-first</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* Skill Chip */}
          <RNAnimated.View style={{
            borderRadius: 14,
            borderWidth: skillChipGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) as unknown as number,
            borderColor: skillChipGlow.interpolate({ inputRange: [0, 1], outputRange: ["transparent", C.accentWarm] }) as unknown as string,
          }}>
          <Pressable
            onPress={() => setShowSkillPicker(true)}
            style={styles.skillChip}
            hitSlop={6}
          >
            <View style={[
              styles.skillChipDot,
              { backgroundColor: activeSkillId
                ? (DOMAIN_CONFIG[detectedSkill?.primary || ""] ?.color ?? C.accent)
                : C.textTertiary },
            ]} />
            <Text
              style={[styles.skillChipText, activeSkillId && { color: C.text }]}
              numberOfLines={1}
            >
              {detectedSkill?.wasAutoDetected && !activeSkillId && (
                <Text style={{ color: C.accentWarm }}>✦ </Text>
              )}
              {activeSkillId
                ? getSelectedSkillName(activeSkillId, skillsByDomain)
                : (detectedSkill?.skillName
                  ? detectedSkill.skillName
                  : "General")}
            </Text>
            <Ionicons name="chevron-down" size={10} color={C.textTertiary} />
          </Pressable>
          </RNAnimated.View>

          {/* New Chat Button */}
          <Pressable
            onPress={() => {
              setMessages([]);
              setCurrentConversationId(null);
              setStreamingText("");
            }}
            style={styles.memoryBtn}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={20} color={C.textSecondary} />
          </Pressable>

          {/* Memory Button */}
          <Pressable
            onPress={() => router.navigate("/(tabs)/memory")}
            style={styles.memoryBtn}
            hitSlop={8}
            testID="memory-btn"
          >
            <Ionicons
              name="layers-outline"
              size={20}
              color={memory.length > 0 ? C.accent : C.textTertiary}
            />
            {memory.length > 0 && <View style={styles.memoryBadge} />}
          </Pressable>
        </View>
      </View>

      {/* KeyboardAvoidingView wraps messages + input so they lift above keyboard */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {/* Empty state or Messages */}
        {displayMessages.length === 0 && !isSending ? (
          <EmptyState onSuggestion={(text, suggMode) => {
            setMode(suggMode as any);
            setInput(text);
            setTimeout(() => sendMessage(), 100);
          }} />
        ) : (<>
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              onMemoryYes={handleMemoryYes}
              onMemoryNo={handleMemoryNo}
              onReply={handleReply}
              onWrapUpSummary={handleWrapUpSummary}
              onWrapUpSaveTasks={handleWrapUpSaveTasks}
              onWrapUpSaveToProject={handleWrapUpSaveToProject}
              onConfidenceTap={(c, r) => setShowConfidencePopup({ confidence: c, reason: r })}
              onCraftPreview={(craft) => setPreviewCraft(craft || null)}
              onRegenerate={(userMsg) => {
                // Remove last AI response and re-send
                setMessages((prev) => prev.filter((m) => m.id !== item.id));
                setInput(userMsg);
                setTimeout(() => sendMessage(), 100);
              }}
              allMessages={messages}
              deviceId={deviceId}
            />
          )}
          inverted
          contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            // Inverted FlatList: offset 0 = bottom, positive = scrolled up
            const offset = e.nativeEvent.contentOffset.y;
            const nearBottom = offset < 100;
            setIsNearBottom(nearBottom);
            setShowScrollBtn(!nearBottom && displayMessages.length > 3);
          }}
          scrollEventThrottle={100}
          ListHeaderComponent={
            savedMemory ? (
              <MemoryNotification
                text={savedMemory.text}
                category={savedMemory.category}
                onDismiss={() => setSavedMemory(null)}
                onTap={() => router.navigate("/(tabs)/memory")}
              />
            ) : thinkingStep ? (
              <ThinkingIndicator step={thinkingStep} sources={thinkingSources} />
            ) : showTyping ? (
              <TypingDots />
            ) : null
          }
          ListFooterComponent={
            isLoadingBrief ? (
              <View style={styles.briefLoading}>
                <ActivityIndicator size="small" color={C.accent} />
                <Text style={styles.briefLoadingText}>Preparing your daily clarity...</Text>
              </View>
            ) : null
          }
        />

        {showScrollBtn && (
          <ScrollToBottomButton onPress={() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            setIsNearBottom(true);
            setShowScrollBtn(false);
          }} />
        )}
        </>
        )}

        {/* Input Area */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(bottomPadding, 8) + 6 }]}>
        {/* Quick Action Chips */}
        <QuickChips
          onChipPress={(chip) => {
            if (chip.label === "Plan") {
              setInput("Plan my day");
              inputRef.current?.focus();
            } else if (chip.label === "Summarize") {
              setInput("Summarize our conversation");
              inputRef.current?.focus();
            } else {
              setMode(chip.mode as ChatMode);
              inputRef.current?.focus();
            }
          }}
          isPrivate={isPrivate}
          currentMode={mode}
        />
        {/* Toolbar separator + mode row */}
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginHorizontal: 4, marginBottom: 4 }} />
        <View style={styles.toolbar}>
          {/* Private Toggle */}
          <Pressable
            onPress={() => setIsPrivate((v) => !v)}
            style={[styles.toolbarBtn, isPrivate && styles.toolbarBtnActive]}
            hitSlop={6}
          >
            <Ionicons
              name={isPrivate ? "eye-off" : "eye-off-outline"}
              size={14}
              color={isPrivate ? C.accent : C.textTertiary}
            />
            <Text style={[styles.toolbarBtnText, isPrivate && styles.toolbarBtnTextActive]}>
              Private
            </Text>
          </Pressable>

          <View style={styles.toolbarDivider} />

          {/* Mode Selector */}
          <Pressable
            onPress={() => setShowModePicker(true)}
            style={styles.toolbarBtn}
            hitSlop={6}
          >
            <Ionicons name={MODE_ICONS[mode]} size={14} color={mode !== "chat" ? C.accent : C.textTertiary} />
            <Text style={[styles.toolbarBtnText, mode !== "chat" && styles.toolbarBtnTextActive]}>
              {MODE_LABELS[mode]}
            </Text>
            <Ionicons name="chevron-down" size={10} color={C.textTertiary} />
          </Pressable>

          <View style={styles.toolbarDivider} />

          {/* Explain Level */}
          <Pressable
            onPress={cycleExplainLevel}
            style={styles.toolbarBtn}
            hitSlop={6}
          >
            <Ionicons name="school-outline" size={14} color={explainLevel !== "normal" ? C.accent : C.textTertiary} />
            <Text style={[styles.toolbarBtnText, explainLevel !== "normal" && styles.toolbarBtnTextActive]}>
              {EXPLAIN_LABELS[explainLevel]}
            </Text>
          </Pressable>
        </View>

        {replyTo && (
          <Animated.View entering={FadeInDown.duration(150)} style={styles.replyPreviewBar}>
            <View style={styles.replyPreviewBarLeft}>
              <View style={styles.replyBar} />
              <View style={styles.replyPreviewBarContent}>
                <Text style={styles.replyPreviewBarLabel}>
                  Replying to {replyTo.role === "user" ? "yourself" : "Aura"}
                </Text>
                <Text style={styles.replyPreviewBarText} numberOfLines={1}>
                  {formatAuraText(replyTo.content).slice(0, 60)}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.textTertiary} />
            </Pressable>
          </Animated.View>
        )}

        {attachments.length > 0 && (
          <View style={styles.attachmentPreviewRow}>
            {attachments.map((att, i) => (
              <View key={i} style={styles.attachmentChip}>
                {att.type.startsWith("image/") ? (
                  <Image source={{ uri: att.uri }} style={styles.attachmentThumb} />
                ) : (
                  <View style={styles.attachmentFileIcon}>
                    <Ionicons name="document-outline" size={14} color={C.accent} />
                  </View>
                )}
                <Text style={styles.attachmentChipText} numberOfLines={1}>{att.name}</Text>
                <Pressable onPress={() => removeAttachment(i)} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color={C.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Input Row */}
        <View style={styles.inputRow}>
          <Pressable
            onPress={showAttachmentPicker}
            style={styles.attachBtn}
            hitSlop={6}
            disabled={isSending || attachments.length >= 5}
            testID="attach-btn"
          >
            <Ionicons
              name="attach-outline"
              size={22}
              color={attachments.length > 0 ? C.accent : C.textTertiary}
            />
          </Pressable>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={isPrivate ? "Private message (not stored)..." : ROTATING_PLACEHOLDERS[placeholderIndex]}
            placeholderTextColor={C.textTertiary}
            multiline
            maxLength={4000}
            returnKeyType="default"
            testID="message-input"
            {...(Platform.OS === "web" ? {
              onKeyPress: (e: any) => {
                if (e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
                  e.preventDefault();
                  if ((input.trim() || attachments.length > 0) && !isSending) {
                    sendMessage();
                  }
                }
              },
            } : {})}
          />
          <Pressable
            onPress={sendMessage}
            disabled={(!input.trim() && attachments.length === 0) || isSending}
            style={({ pressed }) => [
              styles.sendBtn,
              ((!input.trim() && attachments.length === 0) || isSending) && styles.sendBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
            testID="send-btn"
          >
            <Ionicons
              name="arrow-up"
              size={17}
              color={(!input.trim() && attachments.length === 0) || isSending ? C.textTertiary : "#fff"}
            />
          </Pressable>
        </View>
      </View>
      </KeyboardAvoidingView>

      <ModePickerModal
        visible={showModePicker}
        currentMode={mode}
        onSelect={setMode}
        onClose={() => setShowModePicker(false)}
      />
      {showConfidencePopup && (
        <ConfidencePopup
          visible={true}
          confidence={showConfidencePopup.confidence}
          reason={showConfidencePopup.reason}
          onClose={() => setShowConfidencePopup(null)}
        />
      )}
      <SkillPickerSheet
        visible={showSkillPicker}
        skillsByDomain={skillsByDomain}
        activeSkillId={activeSkillId}
        onSelect={setActiveSkillId}
        onClose={() => setShowSkillPicker(false)}
      />
      <CraftPreview
        visible={!!previewCraft}
        craft={previewCraft || null}
        deviceId={deviceId}
        onClose={() => setPreviewCraft(null)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  keyboardAvoid: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.accentGlow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.accentGlowStrong,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  headerAvatarMiddle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accentGlow,
    borderWidth: 1,
    borderColor: C.accentGlowStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  headerTitle: { fontSize: 15, fontWeight: "600", color: C.text, fontFamily: "Inter_600SemiBold" },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  headerOnlineDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: C.accent,
  },
  headerStatus: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  memoryBtn: { position: "relative", padding: 4 },
  memoryBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
  },
  skillChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  skillChipDot: { width: 7, height: 7, borderRadius: 4 },
  skillChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textTertiary, maxWidth: 100 },

  listContent: { paddingHorizontal: 16, paddingTop: 8 },

  bubbleWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 3,
  },
  bubbleWrapUser: { justifyContent: "flex-end" },
  bubbleWrapAgent: { justifyContent: "flex-start" },
  avatarSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accentGlow,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
    borderWidth: 1,
    borderColor: C.accentGlowStrong,
    flexShrink: 0,
  },
  avatarA: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: C.accent,
    marginTop: -1,
  },
  bubbleColumn: { maxWidth: "82%", gap: 4 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: "100%",
  },
  bubbleUser: {
    backgroundColor: C.userBubble,
    borderBottomRightRadius: 5,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  bubbleAgent: {
    backgroundColor: C.assistantBubble,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.shadowSm,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
  bubbleText: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular" },
  bubbleTextUser: { color: "#FFFFFF" },
  bubbleTextAgent: { color: C.text },
  typingBubble: { paddingVertical: 12, paddingHorizontal: 16 },

  privateIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 2,
    alignSelf: "flex-end",
  },
  privateText: { fontSize: 9, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  replyPreviewInBubble: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: C.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 2,
    gap: 8,
  },
  replyPreviewInBubbleUser: {
    backgroundColor: C.surfaceTertiary,
    alignSelf: "flex-end",
  },
  replyBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
  replyBarUser: {
    backgroundColor: "#fff",
  },
  replyPreviewInBubbleText: {
    fontSize: 12,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 17,
  },
  replyPreviewInBubbleTextUser: {
    color: C.textSecondary,
  },

  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 3,
  },
  actionBarUser: {
    alignSelf: "flex-end",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnText: {
    fontSize: 12,
    color: C.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  actionDivider: {
    width: 1,
    height: 14,
    backgroundColor: C.border,
  },

  replyPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
  },
  replyPreviewBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  replyPreviewBarContent: {
    flex: 1,
    gap: 2,
  },
  replyPreviewBarLabel: {
    fontSize: 11,
    color: C.accent,
    fontFamily: "Inter_600SemiBold",
  },
  replyPreviewBarText: {
    fontSize: 12,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },

  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  confidenceDot: { width: 5, height: 5, borderRadius: 3 },
  confidenceText: { fontSize: 10, fontFamily: "Inter_500Medium" },

  confidenceOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  confidencePopup: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    borderWidth: 1,
    borderColor: C.border,
  },
  confidencePopupHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
  },
  confidencePopupDot: { width: 8, height: 8, borderRadius: 4 },
  confidencePopupLevel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  confidencePopupDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  confidencePopupReasonBox: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  confidencePopupReasonLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: C.textTertiary,
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  confidencePopupReason: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textPrimary,
    lineHeight: 19,
  },
  confidencePopupHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
    textAlign: "center" as const,
  },

  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: C.accent + "18",
    alignSelf: "flex-start",
    marginBottom: 3,
  },
  modeBadgeText: { fontSize: 10, color: C.accent, fontFamily: "Inter_500Medium" },

  citationsWrap: { marginTop: 4, gap: 4 },
  citationsLabel: { fontSize: 10, color: C.textTertiary, fontFamily: "Inter_500Medium", marginBottom: 2 },
  citationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 3,
  },
  citationText: {
    fontSize: 11,
    color: C.accent,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
    flex: 1,
  },

  briefCard: {
    backgroundColor: C.assistantBubble,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.accent + "30",
    gap: 10,
  },
  briefHeader: { flexDirection: "row", alignItems: "center" },
  briefBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.accent + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  briefBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent },
  briefBadgeText: { fontSize: 10, color: C.accent, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  briefRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  briefIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: C.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  briefRowText: { flex: 1, fontSize: 13, color: C.text, lineHeight: 20, fontFamily: "Inter_400Regular" },
  briefActionRow: {},
  briefActionIcon: { backgroundColor: C.accent },
  briefActionText: { fontFamily: "Inter_500Medium", color: "#E0E8FF" },
  briefLoading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 20 },
  briefLoadingText: { fontSize: 13, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  memoryPromptCard: {
    backgroundColor: C.assistantBubble,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.accent + "30",
    gap: 12,
  },
  memoryPromptText: {
    fontSize: 14,
    color: C.text,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  memoryPromptButtons: { flexDirection: "row", gap: 10 },
  memoryPromptYes: {
    flex: 1,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  memoryPromptYesText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  memoryPromptNo: {
    flex: 1,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  memoryPromptNoText: { color: C.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium" },

  inputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    backgroundColor: C.background,
    paddingTop: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 2,
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toolbarBtnActive: { backgroundColor: C.accent + "18" },
  toolbarBtnText: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_500Medium" },
  toolbarBtnTextActive: { color: C.accent },
  toolbarDivider: { width: 1, height: 14, backgroundColor: C.border, marginHorizontal: 2 },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    color: C.text,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
    borderWidth: 1,
    borderColor: C.border,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: C.surfaceTertiary },

  modalOverlay: {
    flex: 1,
    justifyContent: Platform.OS === "web" ? "center" : "flex-end",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...(Platform.OS === "web" ? { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, maxWidth: 480, width: "100%" as any } : {}),
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "80%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.surfaceTertiary,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: C.text, fontFamily: "Inter_700Bold" },
  modalHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalRefresh: { padding: 4 },
  modalClose: { padding: 4 },
  modalSubtitle: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },

  memoryList: { maxHeight: 320 },
  memoryItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  memoryItemLeft: { flex: 1, gap: 2 },
  memoryItemMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  memoryItemCategory: {
    fontSize: 10,
    color: C.accent,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "Inter_600SemiBold",
  },
  memoryConfidenceChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  memoryConfidenceText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  memoryItemText: { fontSize: 13, color: C.text, fontFamily: "Inter_400Regular", lineHeight: 18 },
  memoryDeleteBtn: { padding: 2, marginTop: 2 },
  memoryEmpty: { alignItems: "center", gap: 10, paddingVertical: 40 },
  memoryEmptyText: {
    fontSize: 13,
    color: C.textTertiary,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    maxWidth: 240,
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.error + "30",
  },
  clearAllText: { fontSize: 13, color: C.error, fontFamily: "Inter_500Medium" },

  modeList: { gap: 4, marginBottom: 8 },
  modeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: C.surfaceSecondary,
  },
  modeOptionActive: { backgroundColor: C.accent + "18" },
  modeOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  modeOptionIconActive: { backgroundColor: C.accent },
  modeOptionText: { flex: 1, gap: 2 },
  modeOptionLabel: { fontSize: 14, color: C.text, fontFamily: "Inter_600SemiBold" },
  modeOptionLabelActive: { color: C.accent },
  modeOptionDesc: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  downloadBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.accent,
    borderRadius: 8,
    alignSelf: "flex-start" as const,
  },
  downloadBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },

  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentPreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 2,
  },
  attachmentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 8,
    maxWidth: 180,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  attachmentThumb: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  attachmentFileIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: C.accent + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentChipText: {
    flex: 1,
    fontSize: 11,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  attachmentBubbleList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    alignSelf: "flex-end",
    maxWidth: "100%",
    marginBottom: 2,
  },
  attachmentBubbleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.surfaceTertiary,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  attachmentBubbleText: {
    fontSize: 10,
    color: C.textPrimary,
    fontFamily: "Inter_400Regular",
    maxWidth: 100,
  },
});
