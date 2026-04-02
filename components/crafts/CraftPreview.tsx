/**
 * CraftPreview — modal preview for crafts.
 * Shows content preview for inline types, download button for binary types.
 */

import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface CraftData {
  id: string;
  title: string;
  kind: string;
  downloadUrl?: string;
  content?: string;
  filename: string;
}

const KIND_LABELS: Record<string, string> = {
  pdf: "PDF Document", docx: "Word Document", pptx: "Presentation",
  xlsx: "Spreadsheet", html: "HTML Page", react: "React Component",
  code: "Code", svg: "SVG Image", markdown: "Markdown",
};

const INLINE_KINDS = new Set(["html", "react", "svg", "markdown", "code"]);

export function CraftPreview({
  visible,
  craft,
  deviceId,
  onClose,
}: {
  visible: boolean;
  craft: CraftData | null;
  deviceId: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!craft) return null;

  const isInline = INLINE_KINDS.has(craft.kind);
  const label = KIND_LABELS[craft.kind] || craft.kind;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const baseUrl = getApiUrl();
      const url = `${baseUrl}${craft.downloadUrl || `/api/crafts/${craft.id}/download`}`;
      const headers = { "x-device-id": deviceId };

      if (Platform.OS === "web") {
        const resp = await global.fetch(url, { headers });
        if (resp.ok) {
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = craft.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }
      } else {
        const LegacyFS = await import("expo-file-system/legacy");
        const Sharing = await import("expo-sharing");
        const fileUri = LegacyFS.documentDirectory + craft.filename;
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const arrayBuf = await resp.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
          await LegacyFS.writeAsStringAsync(fileUri, base64, {
            encoding: LegacyFS.EncodingType.Base64,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, { dialogTitle: craft.title });
          }
        }
      }
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    if (!craft.content) return;
    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(craft.content);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "85%" }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title} numberOfLines={2}>{craft.title}</Text>
              <View style={styles.kindBadge}>
                <Text style={styles.kindText}>{label}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={C.textSecondary} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView style={styles.contentArea} showsVerticalScrollIndicator={false}>
            {isInline && craft.content ? (
              <View style={styles.codeBlock}>
                <Text style={styles.codeText} selectable>
                  {craft.content}
                </Text>
              </View>
            ) : (
              <View style={styles.binaryInfo}>
                <View style={styles.binaryIcon}>
                  <Ionicons name="document-text-outline" size={32} color={C.accent} />
                </View>
                <Text style={styles.binaryTitle}>{craft.filename}</Text>
                <Text style={styles.binaryHint}>This craft is ready to download</Text>
              </View>
            )}
          </ScrollView>

          {/* Action Bar */}
          <View style={styles.actionBar}>
            {isInline && craft.content && (
              <Pressable style={styles.action} onPress={handleCopy}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={C.accent} />
                <Text style={styles.actionLabel}>{copied ? "Copied" : "Copy"}</Text>
              </Pressable>
            )}
            {craft.downloadUrl && (
              <Pressable style={[styles.action, styles.actionPrimary]} onPress={handleDownload} disabled={downloading}>
                <Ionicons name={downloading ? "hourglass-outline" : "download-outline"} size={16} color="#FFFFFF" />
                <Text style={[styles.actionLabel, styles.actionPrimaryLabel]}>
                  {downloading ? "Crafting..." : "Download"}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Footer */}
          <Text style={styles.footer}>Crafted by Aura</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: Platform.OS === "web" ? "center" : "flex-end",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: C.border,
    ...(Platform.OS === "web" ? { borderRadius: 24, maxWidth: 520, width: "100%" as any } : {}),
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center", marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  headerLeft: { flex: 1, gap: 6 },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: C.text },
  kindBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: C.accentGlow,
  },
  kindText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: C.accent, textTransform: "uppercase", letterSpacing: 0.5,
  },
  closeBtn: { padding: 4 },
  contentArea: { maxHeight: 400, marginBottom: 16 },
  codeBlock: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  codeText: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: C.text,
    lineHeight: 20,
  },
  binaryInfo: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  binaryIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: C.accentGlow,
    alignItems: "center", justifyContent: "center",
  },
  binaryTitle: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.text },
  binaryHint: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.textTertiary },
  actionBar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  actionPrimary: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  actionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.accent },
  actionPrimaryLabel: { color: "#FFFFFF" },
  footer: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
    marginBottom: 4,
  },
});
