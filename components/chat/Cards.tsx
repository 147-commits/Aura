import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { C, type BriefData } from "./types";

// ─── Brief Card ──────────────────────────────────────────────────────────

export function BriefCard({ data }: { data: BriefData }) {
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

// ─── Memory Prompt Card ──────────────────────────────────────────────────

export function MemoryPromptCard({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
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

// ─── Wrap-Up Card ────────────────────────────────────────────────────────

export function WrapUpCard({
  onSummary,
  onSaveTasks,
  onSaveToProject,
}: {
  onSummary: () => void;
  onSaveTasks: () => void;
  onSaveToProject: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.wrapUpContainer}>
      <View style={styles.wrapUpHeader}>
        <Ionicons name="flag-outline" size={14} color={C.accent} />
        <Text style={styles.wrapUpHeaderText}>Conversation wrap-up</Text>
      </View>
      <Text style={styles.wrapUpDescription}>
        Looks like we covered a lot. Want to capture anything before moving on?
      </Text>
      <View style={styles.wrapUpActions}>
        <Pressable style={styles.wrapUpActionBtn} onPress={onSummary}>
          <Ionicons name="document-text-outline" size={16} color={C.accent} />
          <Text style={styles.wrapUpActionBtnText}>Summary</Text>
        </Pressable>
        <Pressable style={styles.wrapUpActionBtn} onPress={onSaveTasks}>
          <Ionicons name="checkbox-outline" size={16} color={C.accent} />
          <Text style={styles.wrapUpActionBtnText}>Save Tasks</Text>
        </Pressable>
        <Pressable style={styles.wrapUpActionBtn} onPress={onSaveToProject}>
          <Ionicons name="folder-outline" size={16} color="#8B5CF6" />
          <Text style={[styles.wrapUpActionBtnText, { color: "#8B5CF6" }]}>Save to Project</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Brief
  briefCard: {
    backgroundColor: "#111820",
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
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  briefRowText: { flex: 1, fontSize: 13, color: C.text, lineHeight: 20, fontFamily: "Inter_400Regular" },
  briefActionRow: {},
  briefActionIcon: { backgroundColor: C.accent },
  briefActionText: { fontFamily: "Inter_500Medium", color: "#E0E8FF" },

  // Memory Prompt
  memoryPromptCard: {
    backgroundColor: "#14182A",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.accent + "30",
    gap: 12,
  },
  memoryPromptText: { fontSize: 14, color: C.text, lineHeight: 21, fontFamily: "Inter_400Regular" },
  memoryPromptButtons: { flexDirection: "row", gap: 10 },
  memoryPromptYes: { flex: 1, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  memoryPromptYesText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  memoryPromptNo: { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  memoryPromptNoText: { color: C.textSecondary, fontSize: 13, fontFamily: "Inter_500Medium" },

  // Wrap-Up
  wrapUpContainer: {
    backgroundColor: "#111820",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.accent + "30",
    gap: 10,
  },
  wrapUpHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  wrapUpHeaderText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.accent, letterSpacing: 0.3 },
  wrapUpDescription: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 19 },
  wrapUpActions: { flexDirection: "row", gap: 8, marginTop: 2 },
  wrapUpActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  wrapUpActionBtnText: { fontSize: 12, color: C.accent, fontFamily: "Inter_500Medium" },
});
