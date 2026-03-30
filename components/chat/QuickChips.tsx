import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, MODE_LABELS, MODE_ICONS, type ChatMode } from "./types";

export const QUICK_CHIPS: { label: string; mode: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Plan", mode: "chat", icon: "calendar-outline" },
  { label: "Summarize", mode: "chat", icon: "list-outline" },
  { label: "Brainstorm", mode: "brainstorm", icon: "bulb-outline" },
  { label: "Decide", mode: "decision", icon: "git-branch-outline" },
];

export function QuickChips({
  onChipPress,
  isPrivate,
  currentMode,
}: {
  onChipPress: (chip: (typeof QUICK_CHIPS)[0]) => void;
  isPrivate: boolean;
  currentMode: ChatMode;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={styles.container}>
      {QUICK_CHIPS.map((chip) => {
        const isActive =
          (chip.mode === "private" && isPrivate) ||
          (chip.mode !== "chat" && chip.mode !== "private" && chip.mode === currentMode);
        return (
          <Pressable key={chip.label} style={[styles.chip, isActive && styles.chipActive]} onPress={() => onChipPress(chip)}>
            <Ionicons name={chip.icon} size={12} color={isActive ? C.accent : C.textSecondary} />
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ModeBadge({ mode }: { mode: ChatMode }) {
  if (mode === "chat") return null;
  return (
    <View style={styles.modeBadge}>
      <Ionicons name={MODE_ICONS[mode] as any} size={10} color={C.accent} />
      <Text style={styles.modeBadgeText}>{MODE_LABELS[mode]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { maxHeight: 36 },
  container: { flexDirection: "row", gap: 6, paddingHorizontal: 4, paddingBottom: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)",
  },
  chipActive: { backgroundColor: C.accent + "22", borderColor: C.accent + "44" },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.textSecondary },
  chipTextActive: { color: C.accent },
  modeBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, backgroundColor: C.accent + "18", alignSelf: "flex-start", marginBottom: 3,
  },
  modeBadgeText: { fontSize: 10, color: C.accent, fontFamily: "Inter_500Medium" },
});
