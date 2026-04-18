/**
 * InlineCitation — superscript citation number with source popover.
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.dark;

const QUALITY_ICONS: Record<string, { icon: string; label: string }> = {
  academic: { icon: "🏛️", label: "Academic" },
  government: { icon: "🏛️", label: "Government" },
  news: { icon: "📰", label: "News" },
  documentation: { icon: "📖", label: "Documentation" },
  blog: { icon: "📝", label: "Blog" },
  user_provided: { icon: "📝", label: "User-provided" },
};

interface Source {
  title: string;
  url?: string;
  quality?: number;
  sourceType?: string;
}

export function InlineCitation({
  index,
  source,
}: {
  index: number;
  source: Source;
}) {
  const [showPopover, setShowPopover] = useState(false);
  const qualityInfo = QUALITY_ICONS[source.sourceType || "blog"] || QUALITY_ICONS.blog;

  return (
    <>
      <Pressable onPress={() => setShowPopover(true)}>
        <Text style={styles.superscript}>[{index}]</Text>
      </Pressable>

      <Modal visible={showPopover} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setShowPopover(false)}>
          <View style={styles.popover}>
            <View style={styles.popoverHeader}>
              <Text style={styles.qualityIcon}>{qualityInfo.icon}</Text>
              <Text style={styles.qualityLabel}>{qualityInfo.label}</Text>
              {source.quality !== undefined && (
                <Text style={styles.qualityScore}>{Math.round(source.quality * 100)}%</Text>
              )}
            </View>
            <Text style={styles.sourceTitle} numberOfLines={2}>{source.title}</Text>
            {source.url && (
              <Pressable
                style={styles.openLink}
                onPress={() => { Linking.openURL(source.url!); setShowPopover(false); }}
              >
                <Ionicons name="open-outline" size={12} color={C.accent} />
                <Text style={styles.openLinkText}>Open source</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  superscript: {
    fontSize: 10,
    color: C.accent,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 14,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 32,
  },
  popover: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    maxWidth: 300,
    width: "100%",
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  popoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qualityIcon: { fontSize: 16 },
  qualityLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  qualityScore: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.accent, marginLeft: "auto" },
  sourceTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.text, lineHeight: 20 },
  openLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
  },
  openLinkText: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.accent },
});
