/**
 * ProjectsList — list of user's builder projects with management.
 */

import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import type { BuilderProject } from "@/shared/schema";

const C = Colors.dark;

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  website: "globe-outline",
  "mobile-app": "phone-portrait-outline",
};

export function ProjectsList({
  projects,
  onSelect,
  onDelete,
  onNew,
}: {
  projects: BuilderProject[];
  onSelect: (project: BuilderProject) => void;
  onDelete: (projectId: string) => void;
  onNew: () => void;
}) {
  const handleDelete = (id: string, name: string) => {
    if (Platform.OS === "web") {
      if (confirm(`Delete "${name}"?`)) onDelete(id);
    } else {
      Alert.alert("Delete Project", `Delete "${name}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(id) },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.newBtn} onPress={onNew}>
        <Ionicons name="add" size={20} color={C.accent} />
        <Text style={styles.newBtnText}>New Project</Text>
      </Pressable>

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).duration(250)}>
            <Pressable
              style={styles.card}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(item);
              }}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={TYPE_ICONS[item.type] || "globe-outline"} size={20} color={C.accent} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <View style={styles.meta}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>{item.type === "mobile-app" ? "App" : "Website"}</Text>
                  </View>
                  <Text style={styles.date}>
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item.id, item.name)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={C.textTertiary} />
              </Pressable>
            </Pressable>
          </Animated.View>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="globe-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyText}>No projects yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.accentGlow,
    borderWidth: 1,
    borderColor: C.accent,
  },
  newBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.accent },
  list: { gap: 6, paddingBottom: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accentGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: C.accentGlow,
  },
  typeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: C.accent, textTransform: "uppercase" },
  date: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textTertiary },
  deleteBtn: { padding: 6 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textTertiary },
});
