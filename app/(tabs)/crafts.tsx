/**
 * Crafts Tab — browse, preview, and manage all crafted artifacts.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, RefreshControl, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";
import { useIsWideWeb } from "@/components/WebContainer";
import WebContainer from "@/components/WebContainer";
import { CraftPreview } from "@/components/crafts/CraftPreview";

const C = Colors.dark;
const DEVICE_ID_KEY = "aura:device_id";

interface CraftItem {
  id: string;
  kind: string;
  title: string;
  filename: string;
  content?: string;
  filePath?: string;
  createdAt: string;
}

interface CraftTemplate {
  id: string;
  name: string;
  kind: string;
  description: string;
  prompt: string;
  icon: string;
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
  pdf: "PDF", docx: "DOCX", pptx: "PPTX", xlsx: "XLSX",
  html: "HTML", react: "React", code: "Code", svg: "SVG", markdown: "MD",
};

function groupByDate(items: CraftItem[]): { title: string; data: CraftItem[] }[] {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).getTime();

  const groups: Record<string, CraftItem[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Earlier: [],
  };

  for (const item of items) {
    const d = new Date(item.createdAt);
    if (d.toDateString() === today) groups.Today.push(item);
    else if (d.toDateString() === yesterday) groups.Yesterday.push(item);
    else if (d.getTime() > weekAgo) groups["This Week"].push(item);
    else groups.Earlier.push(item);
  }

  return Object.entries(groups)
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
}

async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export default function CraftsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWideWeb = useIsWideWeb();
  const topPadding = Platform.OS === "web" ? (isWideWeb ? 16 : 67) : insets.top;

  const [crafts, setCrafts] = useState<CraftItem[]>([]);
  const [templates, setTemplates] = useState<CraftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState("anonymous");
  const [previewCraft, setPreviewCraft] = useState<any>(null);

  const fetchCrafts = useCallback(async (devId?: string) => {
    try {
      const id = devId || deviceId;
      const baseUrl = getApiUrl();
      const resp = await fetch(new URL("/api/crafts", baseUrl).toString(), {
        headers: { "Content-Type": "application/json", "x-device-id": id },
      });
      if (resp.ok) {
        const data = await resp.json();
        setCrafts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn("Failed to fetch crafts:", err);
    }
  }, [deviceId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const resp = await fetch(new URL("/api/craft-templates", baseUrl).toString());
      if (resp.ok) setTemplates(await resp.json());
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      await Promise.all([fetchCrafts(id), fetchTemplates()]);
      setLoading(false);
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCrafts();
    setRefreshing(false);
  };

  const handleDelete = async (craftId: string) => {
    const doDelete = async () => {
      try {
        const baseUrl = getApiUrl();
        await fetch(new URL(`/api/crafts/${craftId}`, baseUrl).toString(), {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        });
        setCrafts((prev) => prev.filter((c) => c.id !== craftId));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    };

    if (Platform.OS === "web") {
      if (confirm("Delete this craft?")) await doDelete();
    } else {
      Alert.alert("Delete Craft", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleTemplatePress = (template: CraftTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.navigate({ pathname: "/(tabs)/aura", params: { prefill: template.prompt } });
  };

  const groups = groupByDate(crafts);

  // Build flat list data with section headers
  const listData: ({ type: "header"; title: string } | { type: "craft"; item: CraftItem })[] = [];
  for (const group of groups) {
    listData.push({ type: "header", title: group.title });
    for (const item of group.data) {
      listData.push({ type: "craft", item });
    }
  }

  const content = (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Crafts</Text>
        {crafts.length > 0 && (
          <Text style={styles.headerSubtitle}>{crafts.length} item{crafts.length !== 1 ? "s" : ""}</Text>
        )}
      </View>

      {crafts.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Ionicons name="hammer-outline" size={48} color={C.textTertiary} />
          <Text style={styles.emptyTitle}>No Crafts yet</Text>
          <Text style={styles.emptyText}>Ask Aura to create something for you</Text>

          <View style={styles.templateGrid}>
            {templates.map((t) => (
              <Pressable
                key={t.id}
                style={styles.templateCard}
                onPress={() => handleTemplatePress(t)}
              >
                <Ionicons name={(t.icon as any) || "document-outline"} size={20} color={C.accent} />
                <Text style={styles.templateName}>{t.name}</Text>
                <Text style={styles.templateDesc} numberOfLines={1}>{t.description}</Text>
                <View style={styles.templateKindBadge}>
                  <Text style={styles.templateKindText}>{KIND_LABELS[t.kind] || t.kind}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, i) => item.type === "header" ? `h-${item.title}` : `c-${item.item.id}`}
          renderItem={({ item, index }) => {
            if (item.type === "header") {
              return (
                <Text style={styles.sectionHeader}>{item.title}</Text>
              );
            }
            return (
              <Animated.View entering={FadeInDown.delay(index * 50).duration(250).springify()}>
                <Pressable
                  style={styles.craftCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPreviewCraft({
                      id: item.item.id,
                      title: item.item.title,
                      kind: item.item.kind,
                      content: item.item.content,
                      downloadUrl: item.item.filePath ? `/api/crafts/${item.item.id}/download` : undefined,
                      filename: item.item.filename,
                    });
                  }}
                >
                  <View style={styles.craftIconWrap}>
                    <Ionicons
                      name={KIND_ICONS[item.item.kind] || "document-outline"}
                      size={20}
                      color={C.accent}
                    />
                  </View>
                  <View style={styles.craftInfo}>
                    <Text style={styles.craftTitle} numberOfLines={1}>{item.item.title}</Text>
                    <View style={styles.craftMeta}>
                      <View style={styles.craftKindBadge}>
                        <Text style={styles.craftKindText}>{KIND_LABELS[item.item.kind] || item.item.kind}</Text>
                      </View>
                      <Text style={styles.craftDate}>
                        {new Date(item.item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.item.id)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={C.textTertiary} />
                  </Pressable>
                </Pressable>
              </Animated.View>
            );
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <CraftPreview
        visible={!!previewCraft}
        craft={previewCraft}
        deviceId={deviceId}
        onClose={() => setPreviewCraft(null)}
      />
    </View>
  );

  if (Platform.OS === "web" && isWideWeb) {
    return content;
  }
  return content;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: C.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginTop: 8,
  },
  craftCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  craftIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accentGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  craftInfo: { flex: 1, gap: 4 },
  craftTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  craftMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  craftKindBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: C.accentGlow,
  },
  craftKindText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: C.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  craftDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  deleteBtn: {
    padding: 6,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  templateGrid: {
    width: "100%",
    gap: 10,
  },
  templateCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  templateName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  templateDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  templateKindBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: C.accentGlow,
    marginTop: 2,
  },
  templateKindText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: C.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
