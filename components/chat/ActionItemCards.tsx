import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";
import { C, type ActionItem } from "./types";

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

export function ActionItemCards({
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
      const headers = { "Content-Type": "application/json", "x-device-id": deviceId };

      if (item.type === "task") {
        await global.fetch(new URL("/api/tasks", baseUrl).toString(), {
          method: "POST", headers,
          body: JSON.stringify({ title: item.title, description: item.description, priority: item.priority || "medium" }),
        });
      } else if (item.type === "project") {
        await global.fetch(new URL("/api/projects", baseUrl).toString(), {
          method: "POST", headers,
          body: JSON.stringify({ name: item.title, description: item.description }),
        });
      } else if (item.type === "memory") {
        await global.fetch(new URL("/api/memories", baseUrl).toString(), {
          method: "POST", headers,
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
    <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flash-outline" size={12} color={C.accent} />
        <Text style={styles.headerText}>Suggested actions</Text>
        <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismissBtn}>
          <Ionicons name="close" size={14} color={C.textTertiary} />
        </Pressable>
      </View>
      {items.map((item, i) => {
        const isAccepted = accepted.has(i);
        const color = ACTION_COLORS[item.type] || C.accent;
        return (
          <View key={i} style={[styles.card, isAccepted && styles.cardAccepted]}>
            <View style={[styles.iconWrap, { backgroundColor: color + "22" }]}>
              <Ionicons name={ACTION_ICONS[item.type] || "add-outline"} size={14} color={color} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
            </View>
            {isAccepted ? (
              <View style={styles.acceptedBadge}>
                <Ionicons name="checkmark" size={12} color="#22C55E" />
              </View>
            ) : (
              <Pressable
                onPress={() => handleAccept(item, i)}
                disabled={processing === i}
                style={[styles.addBtn, { backgroundColor: color + "22" }]}
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

const styles = StyleSheet.create({
  container: { marginTop: 6, marginLeft: 29, maxWidth: "82%" },
  header: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  headerText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.textSecondary, flex: 1 },
  dismissBtn: { padding: 2 },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.surface,
    borderRadius: 12, padding: 10, marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.06)", gap: 8,
  },
  cardAccepted: { opacity: 0.6 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  cardDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 1 },
  addBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  acceptedBadge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#22C55E22" },
});
