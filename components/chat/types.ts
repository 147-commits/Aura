import type {
  ChatMode,
  ExplainLevel,
  Confidence,
  MessageType,
  Citation,
  BriefData,
  DocumentRequest,
  ActionItem,
  Message,
} from "@shared/schema";
import Colors from "@/constants/colors";

const C = Colors.dark;

// Re-export shared types for chat components
export type {
  ChatMode,
  ExplainLevel,
  Confidence,
  MessageType,
  Citation,
  BriefData,
  DocumentRequest,
  ActionItem,
  Message,
};

export { C };

// ─── Types local to chat UI ─────────────────────────────────────────────

export type MemoryItem = {
  id: string;
  text: string;
  category: string;
  confidence?: string;
  createdAt?: string;
};

export type Attachment = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

export type ReplyTo = {
  id: string;
  content: string;
  role: "user" | "assistant";
};

// ─── Storage Keys ────────────────────────────────────────────────────────

export const MESSAGES_KEY = "aura:messages";
export const BRIEF_DATE_KEY = "aura:brief_date";
export const CHAT_COUNT_KEY = "aura:chat_count";
export const MEMORY_ASKED_KEY = "aura:memory_asked";
export const DEVICE_ID_KEY = "aura:device_id";

// ─── Constants ───────────────────────────────────────────────────────────

export const ROTATING_PLACEHOLDERS = [
  "Plan my day...",
  "Turn this into tasks...",
  "Help me think this through...",
  "Summarize this...",
  "Help me decide...",
  "What should I focus on?",
  "Break this down for me...",
];

export const CONFIDENCE_COLORS: Record<Confidence, string> = {
  High: "#10B981",
  Medium: "#F59E0B",
  Low: "#EF4444",
};

export const CONFIDENCE_DESCRIPTIONS: Record<Confidence, string> = {
  High: "Well-established knowledge backed by multiple reputable sources.",
  Medium: "Contextual advice that is plausible but may vary by situation.",
  Low: "Limited certainty — unverified or depends on specific conditions.",
};

export const MODE_LABELS: Record<ChatMode, string> = {
  chat: "Chat",
  research: "Research",
  decision: "Decision",
  brainstorm: "Brainstorm",
  explain: "Explain",
};

export const MODE_ICONS: Record<ChatMode, string> = {
  chat: "chatbubble-outline",
  research: "search-outline",
  decision: "git-branch-outline",
  brainstorm: "bulb-outline",
  explain: "school-outline",
};

export const CLOSING_SIGNALS = [
  "thanks", "thank you", "got it", "that's all", "thats all",
  "that's it", "thats it", "all good", "perfect", "great thanks",
  "appreciate it", "cheers", "bye", "goodbye", "good night",
  "talk later", "ttyl", "ok thanks", "okay thanks", "will do",
  "sounds good", "noted", "makes sense",
];

// ─── Text Formatting ─────────────────────────────────────────────────────

export function formatAuraText(raw: string): string {
  return raw
    .replace(/\|\|\|DOCUMENT_REQUEST\|\|\|[\s\S]*$/, "")
    .replace(/\|\|\|ACTION_ITEMS\|\|\|[\s\S]*$/, "")
    .replace(/^Confidence:\s*(High|Medium|Low)\s*(?:\([^)]*\))?\s*$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^(\s*)[-*•]\s+/gm, "$1→ ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Helpers ─────────────────────────────────────────────────────────────

export function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

export function shouldShowWrapUp(messages: Message[], latestUserContent: string): boolean {
  const textMessages = messages.filter((m) => m.type === "text");
  if (textMessages.length < 8) return false;
  if (messages.some((m) => m.type === "wrap-up")) return false;
  const lower = latestUserContent.toLowerCase().trim();
  return CLOSING_SIGNALS.some((signal) => lower.includes(signal));
}
