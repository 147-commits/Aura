import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { useIsWideWeb } from "@/components/WebContainer";
import { fetch } from "expo/fetch";
import WebContainer from "@/components/WebContainer";

const C = Colors.dark;
const DEVICE_ID_KEY = "aura:device_id";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "high" | "medium" | "low";
  dueDate: string | null;
  projectId: string | null;
  projectName?: string;
  createdAt: string;
}

interface DailyPlan {
  id: string;
  date: string;
  summary: string;
  taskIds: string[];
  createdAt: string;
}

interface TodayData {
  plan: DailyPlan | null;
  tasks: Task[];
}

function apiHeaders(deviceId: string) {
  return { "Content-Type": "application/json", "x-device-id": deviceId };
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#8B90A8",
};
const PRIORITY_LABELS: Record<string, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function TaskCard({
  task,
  deviceId,
  onComplete,
  index,
}: {
  task: Task;
  deviceId: string;
  onComplete: (id: string) => void;
  index: number;
}) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const [checking, setChecking] = useState(false);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleCheck = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/tasks/${task.id}`, baseUrl);
      await fetch(url.toString(), {
        method: "PATCH",
        headers: apiHeaders(deviceId),
        body: JSON.stringify({ status: "done" }),
      });
      scale.value = withSequence(
        withSpring(1.03, { damping: 8 }),
        withTiming(0.96, { duration: 150 })
      );
      opacity.value = withTiming(0, { duration: 350 }, () => {
        runOnJS(onComplete)(task.id);
      });
    } catch {
      setChecking(false);
    }
  }, [checking, task.id, deviceId, onComplete, opacity, scale]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(400).springify()}
      style={[styles.taskCard, animStyle]}
    >
      <View style={[styles.taskPriorityBar, { backgroundColor: PRIORITY_COLORS[task.priority] }]} />
      <View style={styles.taskCardInner}>
        <TouchableOpacity
          onPress={handleCheck}
          style={styles.checkBtn}
          activeOpacity={0.6}
          disabled={checking}
        >
          {checking ? (
            <Ionicons name="checkmark-circle" size={26} color={C.accent} />
          ) : (
            <View style={styles.checkCircle}>
              <View style={styles.checkCircleInner} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.taskCardContent}>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={styles.taskMeta}>
            <View style={[styles.priorityPill, { backgroundColor: PRIORITY_COLORS[task.priority] + "18" }]}>
              <View style={[styles.priorityPillDot, { backgroundColor: PRIORITY_COLORS[task.priority] }]} />
              <Text style={[styles.priorityPillText, { color: PRIORITY_COLORS[task.priority] }]}>
                {PRIORITY_LABELS[task.priority]}
              </Text>
            </View>
            {task.projectName ? (
              <View style={styles.projectBadge}>
                <Feather name="folder" size={10} color={C.textSecondary} />
                <Text style={styles.projectBadgeText}>{task.projectName}</Text>
              </View>
            ) : null}
            {task.dueDate ? (
              <View style={styles.dueDateBadge}>
                <Feather name="clock" size={10} color={C.textTertiary} />
                <Text style={styles.dueDateText}>
                  {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function PlanStepCard({ text, index }: { text: string; index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 80).duration(400).springify()}
      style={styles.planStep}
    >
      <View style={styles.planStepNumber}>
        <Text style={styles.planStepNumberText}>{index + 1}</Text>
      </View>
      <Text style={styles.planStepText}>{text}</Text>
    </Animated.View>
  );
}

function parsePlanSummary(summary: string): string[] {
  const lines = summary.split("\n").filter((l) => l.trim().length > 0);
  const steps = lines.map((l) =>
    l.replace(/^\d+[\.\)\-]\s*/, "").replace(/^\*\*/, "").replace(/\*\*$/, "").replace(/^\*\*(.+?)\*\*(.*)/, "$1$2").trim()
  );
  return steps.filter((s) => s.length > 0);
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const isWideWeb = useIsWideWeb();
  const topPadding = Platform.OS === "web" ? (isWideWeb ? 16 : 67) : insets.top;

  const [deviceId, setDeviceId] = useState<string>("");
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEVICE_ID_KEY).then((id) => {
      if (id) setDeviceId(id);
    });
  }, []);

  const fetchToday = useCallback(async () => {
    if (!deviceId) return;
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/today", baseUrl);
      const res = await fetch(url.toString(), {
        headers: { "x-device-id": deviceId },
      });
      const json = await res.json();
      setData(json as TodayData);
    } catch {
      setData({ plan: null, tasks: [] });
    }
  }, [deviceId]);

  useEffect(() => {
    if (deviceId) {
      setLoading(true);
      fetchToday().finally(() => setLoading(false));
    }
  }, [deviceId, fetchToday]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchToday();
    setRefreshing(false);
  }, [fetchToday]);

  const handleGenerate = useCallback(async () => {
    if (!deviceId || generating) return;
    setGenerating(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/today/generate", baseUrl);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: apiHeaders(deviceId),
      });
      const json = await res.json();
      setData(json as TodayData);
    } catch {
    } finally {
      setGenerating(false);
    }
  }, [deviceId, generating]);

  const handleTaskComplete = useCallback((taskId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      };
    });
  }, []);

  const sortedTasks = (data?.tasks ?? [])
    .filter((t) => t.status !== "done")
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));

  const plan = data?.plan ?? null;
  const hasPlan = plan && plan.summary;
  const hasNoContent = !hasPlan && sortedTasks.length === 0;
  const planSteps = hasPlan ? parsePlanSummary(plan!.summary) : [];

  if (loading) {
    return (
      <WebContainer maxWidth={800}>
        <View style={[styles.container, { paddingTop: topPadding }]}>
          <View style={styles.header}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.headerDate}>{getFormattedDate()}</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        </View>
      </WebContainer>
    );
  }

  return (
    <WebContainer maxWidth={800}>
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.headerDate}>{getFormattedDate()}</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.accent}
              colors={[C.accent]}
            />
          }
        >
          {!hasPlan ? (
            <Animated.View entering={FadeIn.duration(500)}>
              <TouchableOpacity
                onPress={handleGenerate}
                activeOpacity={0.85}
                disabled={generating}
                style={styles.generateCard}
              >
                <View style={styles.generateCardGlow} />
                <View style={styles.generateCardContent}>
                  <View style={styles.generateIconWrap}>
                    {generating ? (
                      <ActivityIndicator size="small" color={C.accent} />
                    ) : (
                      <Ionicons name="sparkles" size={22} color={C.accent} />
                    )}
                  </View>
                  <View style={styles.generateTextWrap}>
                    <Text style={styles.generateTitle}>
                      {generating ? "Creating your plan..." : "Generate Today's Plan"}
                    </Text>
                    <Text style={styles.generateDesc}>
                      Let Aura analyze your tasks and create a focused plan for today
                    </Text>
                  </View>
                  {!generating && (
                    <View style={styles.generateArrow}>
                      <Feather name="arrow-right" size={18} color={C.accent} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {hasPlan ? (
            <Animated.View entering={FadeIn.duration(500)} style={styles.planSection}>
              <View style={styles.planHeaderRow}>
                <View style={styles.planIconWrap}>
                  <Ionicons name="bulb" size={16} color="#FFC107" />
                </View>
                <Text style={styles.planSectionTitle}>Your Daily Plan</Text>
                <TouchableOpacity
                  onPress={handleGenerate}
                  activeOpacity={0.7}
                  disabled={generating}
                  style={styles.refreshPlanBtn}
                >
                  {generating ? (
                    <ActivityIndicator size="small" color={C.textSecondary} />
                  ) : (
                    <Feather name="refresh-cw" size={14} color={C.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>

              {planSteps.length > 1 ? (
                <View style={styles.planStepsList}>
                  {planSteps.map((step, i) => (
                    <PlanStepCard key={i} text={step} index={i} />
                  ))}
                </View>
              ) : (
                <View style={styles.planSummaryCard}>
                  <Text style={styles.planSummaryText}>{plan!.summary}</Text>
                </View>
              )}
            </Animated.View>
          ) : null}

          {sortedTasks.length > 0 ? (
            <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.tasksSection}>
              <View style={styles.tasksSectionHeader}>
                <View style={styles.tasksSectionLeft}>
                  <Feather name="target" size={16} color={C.textSecondary} />
                  <Text style={styles.sectionTitle}>Focus Tasks</Text>
                </View>
                <View style={styles.taskCountBadge}>
                  <Text style={styles.taskCountText}>{sortedTasks.length}</Text>
                </View>
              </View>
              {sortedTasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  deviceId={deviceId}
                  onComplete={handleTaskComplete}
                  index={index}
                />
              ))}
            </Animated.View>
          ) : null}

          {hasNoContent ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyOrb}>
                <View style={styles.emptyOrbInner} />
              </View>
              <Text style={styles.emptyTitle}>Your day starts here</Text>
              <Text style={styles.emptyText}>
                Start by chatting with Aura or adding some tasks. Then come back here to generate your daily focus plan.
              </Text>
            </View>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: C.text,
    letterSpacing: -0.8,
  },
  headerDate: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  generateCard: {
    position: "relative" as const,
    marginBottom: 24,
    borderRadius: 20,
    overflow: "hidden" as const,
  },
  generateCardGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.15)",
    borderRadius: 20,
  },
  generateCardContent: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: 20,
    gap: 14,
  },
  generateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  generateTextWrap: {
    flex: 1,
  },
  generateTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    marginBottom: 3,
  },
  generateDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 18,
  },
  generateArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  planSection: {
    marginBottom: 28,
  },
  planHeaderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 14,
    gap: 8,
  },
  planIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255, 193, 7, 0.1)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  planSectionTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  refreshPlanBtn: {
    padding: 6,
  },
  planStepsList: {
    gap: 8,
  },
  planStep: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  planStepNumber: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: 1,
  },
  planStepNumberText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: C.accent,
  },
  planStepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
    lineHeight: 21,
  },
  planSummaryCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  planSummaryText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
    lineHeight: 23,
  },

  tasksSection: {
    marginBottom: 20,
  },
  tasksSectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: 14,
  },
  tasksSectionLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
  },
  taskCountBadge: {
    backgroundColor: C.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  taskCountText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
  },

  taskCard: {
    flexDirection: "row" as const,
    backgroundColor: C.surface,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: C.border,
  },
  taskPriorityBar: {
    width: 4,
  },
  taskCardInner: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: 14,
    paddingLeft: 12,
    gap: 10,
  },
  checkBtn: {
    padding: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.textTertiary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  checkCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "transparent",
  },
  taskCardContent: {
    flex: 1,
    gap: 6,
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: C.text,
    lineHeight: 20,
  },
  taskMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flexWrap: "wrap" as const,
    gap: 6,
  },
  priorityPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  priorityPillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  priorityPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  projectBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: C.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  projectBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  dueDateBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  dueDateText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },

  emptyState: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 40,
    paddingVertical: 80,
    gap: 16,
  },
  emptyOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(59, 130, 246, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 4,
  },
  emptyOrbInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
    textAlign: "center" as const,
    lineHeight: 22,
  },
});
