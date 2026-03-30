import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { useIsWideWeb } from "@/components/WebContainer";
import { fetch } from "expo/fetch";
import WebContainer from "@/components/WebContainer";

const C = Colors.dark;
const DEVICE_ID_KEY = "aura:device_id";

interface MemoryItem {
  id: string;
  text: string;
  category: string;
  confidence: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  preference: "#8B90A8",
  goal: "#8B90A8",
  project: "#8B90A8",
  constraint: "#8B90A8",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  High: "#10B981",
  Medium: "#F59E0B",
  Low: "#EF4444",
};

const CATEGORY_ORDER = ["preference", "goal", "project", "constraint"];

function apiHeaders(deviceId: string) {
  return { "Content-Type": "application/json", "x-device-id": deviceId };
}

function MemoryItemRow({
  item,
  onDelete,
}: {
  item: MemoryItem;
  onDelete: (id: string) => void;
}) {
  const catColor = CATEGORY_COLORS[item.category] || C.accent;
  const confColor = CONFIDENCE_COLORS[item.confidence] || C.textTertiary;

  const handleDelete = () => {
    if (Platform.OS === "web") {
      if (confirm("Are you sure you want to forget this?")) {
        onDelete(item.id);
      }
    } else {
      Alert.alert(
        "Delete Memory",
        "Are you sure you want to forget this?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => onDelete(item.id),
          },
        ],
      );
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      layout={Platform.OS !== "web" ? Layout.springify() : undefined}
      style={styles.itemContainer}
    >
      <View style={styles.itemContent}>
        <Text style={styles.itemText}>{item.text}</Text>
        <View style={styles.itemMeta}>
          <View style={[styles.categoryBadge, { backgroundColor: catColor + "20" }]}>
            <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
            <Text style={[styles.categoryText, { color: catColor }]}>
              {item.category}
            </Text>
          </View>
          <View style={[styles.confidenceChip, { backgroundColor: confColor + "18" }]}>
            <Text style={[styles.confidenceText, { color: confColor }]}>
              {item.confidence}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        onPress={handleDelete}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.deleteButton}
      >
        <Ionicons name="trash-outline" size={18} color={C.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MemoryScreen() {
  const insets = useSafeAreaInsets();
  const isWideWeb = useIsWideWeb();
  const topPadding = Platform.OS === "web" ? (isWideWeb ? 16 : 67) : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DEVICE_ID_KEY).then((id) => {
      if (id) setDeviceId(id);
    });
  }, []);

  const fetchMemories = useCallback(async () => {
    if (!deviceId) return;
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/memories", baseUrl);
      const res = await fetch(url.toString(), {
        headers: { "x-device-id": deviceId },
      });
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (deviceId) {
      setLoading(true);
      fetchMemories();
    }
  }, [deviceId, fetchMemories]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMemories();
  }, [fetchMemories]);

  const deleteMemory = useCallback(
    async (id: string) => {
      if (!deviceId) return;
      try {
        const baseUrl = getApiUrl();
        const url = new URL(`/api/memories/${id}`, baseUrl);
        const res = await fetch(url.toString(), {
          method: "DELETE",
          headers: apiHeaders(deviceId),
        });
        if (res.ok) {
          setMemories((prev) => prev.filter((m) => m.id !== id));
        }
      } catch (err) {
        console.error("Failed to delete memory:", err);
      }
    },
    [deviceId],
  );

  const doClearAll = useCallback(async () => {
    if (!deviceId) return;
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/memories", baseUrl);
      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers: apiHeaders(deviceId),
      });
      if (res.ok) {
        setMemories([]);
      }
    } catch (err) {
      console.error("Failed to clear memories:", err);
    }
  }, [deviceId]);

  const clearAll = useCallback(() => {
    if (Platform.OS === "web") {
      if (confirm("This will permanently delete all memories. This action cannot be undone.")) {
        doClearAll();
      }
    } else {
      Alert.alert(
        "Forget Everything",
        "This will permanently delete all memories. This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Forget Everything",
            style: "destructive",
            onPress: doClearAll,
          },
        ],
      );
    }
  }, [doClearAll]);

  const grouped = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      const items = memories.filter((m) => m.category === cat);
      if (items.length > 0) acc.push({ category: cat, items });
      return acc;
    },
    [] as { category: string; items: MemoryItem[] }[],
  );

  const uncategorized = memories.filter(
    (m) => !CATEGORY_ORDER.includes(m.category),
  );
  if (uncategorized.length > 0) {
    grouped.push({ category: "other", items: uncategorized });
  }

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Ionicons name="layers-outline" size={32} color={C.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>Nothing remembered yet</Text>
        <Text style={styles.emptyText}>
          Chat with Aura and your context will appear here.
        </Text>
      </View>
    );
  };

  type SectionItem =
    | { type: "header"; category: string }
    | { type: "memory"; item: MemoryItem };

  const flatData: SectionItem[] = [];
  for (const group of grouped) {
    flatData.push({ type: "header", category: group.category });
    for (const item of group.items) {
      flatData.push({ type: "memory", item });
    }
  }

  const renderItem = ({ item }: { item: SectionItem }) => {
    if (item.type === "header") {
      const catColor = CATEGORY_COLORS[item.category] || C.accent;
      const count = grouped.find((g) => g.category === item.category)?.items
        .length;
      return (
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: catColor }]} />
          <Text style={styles.sectionTitle}>
            {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
          </Text>
          <Text style={styles.sectionCount}>{count}</Text>
        </View>
      );
    }
    return <MemoryItemRow item={item.item} onDelete={deleteMemory} />;
  };

  const keyExtractor = (item: SectionItem, index: number) => {
    if (item.type === "header") return `header-${item.category}`;
    return item.item.id;
  };

  return (
    <WebContainer maxWidth={800}>
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Memory</Text>
        <Text style={styles.headerSubtitle}>
          What Aura remembers about you. Encrypted at rest.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={C.accent} />
        </View>
      ) : memories.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={flatData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomPadding + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.accent}
            />
          }
          ListFooterComponent={
            <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
              <Ionicons
                name="trash-outline"
                size={18}
                color="#EF4444"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.clearButtonText}>Forget everything</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
    </WebContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: C.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 14,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  itemContent: {
    flex: 1,
    marginRight: 12,
  },
  itemText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize" as const,
  },
  confidenceChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  deleteButton: {
    paddingTop: 2,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  clearButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#EF4444",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
    textAlign: "center",
    lineHeight: 20,
  },
});
