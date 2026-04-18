/**
 * CraftCard — inline chat card shown when Aura generates a Craft.
 * Appears in the assistant message bubble area.
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
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

const KIND_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pdf: "document-text-outline",
  docx: "document-text-outline",
  pptx: "easel-outline",
  xlsx: "grid-outline",
  html: "code-slash-outline",
  react: "code-slash-outline",
  code: "code-slash-outline",
  svg: "image-outline",
  markdown: "reader-outline",
};

const KIND_LABELS: Record<string, string> = {
  pdf: "PDF", docx: "Word Doc", pptx: "Slides", xlsx: "Spreadsheet",
  html: "HTML", react: "Component", code: "Code", svg: "SVG", markdown: "Markdown",
};

export function CraftCard({
  craft,
  onPreview,
  deviceId,
}: {
  craft: CraftData;
  onPreview: () => void;
  deviceId: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const icon = KIND_ICONS[craft.kind] || "document-outline";
  const label = KIND_LABELS[craft.kind] || craft.kind.toUpperCase();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      console.error("Craft download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.container}>
      <Pressable
        style={styles.card}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPreview();
        }}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={C.accent} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>{craft.title}</Text>
          <View style={styles.meta}>
            <View style={styles.kindBadge}>
              <Text style={styles.kindText}>{label}</Text>
            </View>
            <Text style={styles.hint}>Tap to preview</Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.actions}>
        {craft.downloadUrl && (
          <Pressable style={styles.actionBtn} onPress={handleDownload} disabled={downloading}>
            <Ionicons
              name={downloading ? "hourglass-outline" : "download-outline"}
              size={14}
              color={C.accent}
            />
            <Text style={styles.actionText}>{downloading ? "Crafting..." : "Download"}</Text>
          </Pressable>
        )}
        {craft.content && (
          <Pressable
            style={styles.actionBtn}
            onPress={async () => {
              const Clipboard = await import("expo-clipboard");
              await Clipboard.setStringAsync(craft.content!);
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name="copy-outline" size={14} color={C.accent} />
            <Text style={styles.actionText}>Copy</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    marginLeft: 29,
    maxWidth: "82%",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.shadowSm,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accentGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, gap: 4 },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  kindBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: C.accentGlow,
  },
  kindText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: C.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    paddingLeft: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.accent,
  },
});
