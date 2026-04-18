import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";
import { useIsWideWeb } from "@/components/WebContainer";
import WebContainer from "@/components/WebContainer";

const C = Colors.dark;
const DEVICE_ID_KEY = "aura:device_id";

const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#8B90A8",
};

const PRIORITY_ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  high: { name: "flag", color: "#EF4444" },
  medium: { name: "flag", color: "#F59E0B" },
  low: { name: "flag-outline", color: "#8B90A8" },
};

const STATUS_ORDER = ["todo", "in_progress", "done"] as const;
const STATUS_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  todo: { label: "To Do", icon: "radio-button-off", color: C.textSecondary },
  in_progress: { label: "In Progress", icon: "time-outline", color: C.accent },
  done: { label: "Completed", icon: "checkmark-circle", color: C.success },
};

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

interface Project {
  id: string;
  name: string;
  color: string;
}

async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

async function apiHeaders(): Promise<Record<string, string>> {
  const deviceId = await getDeviceId();
  return { "Content-Type": "application/json", "x-device-id": deviceId };
}

async function fetchTasks(): Promise<Task[]> {
  const headers = await apiHeaders();
  const res = await fetch(new URL("/api/tasks", getApiUrl()).toString(), { headers });
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

async function fetchProjects(): Promise<Project[]> {
  const headers = await apiHeaders();
  const res = await fetch(new URL("/api/projects", getApiUrl()).toString(), { headers });
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

function nextStatus(current: string): "todo" | "in_progress" | "done" {
  if (current === "todo") return "in_progress";
  if (current === "in_progress") return "done";
  return "todo";
}

function AnimatedFAB({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <Animated.View style={[styles.fabContainer, { bottom }, animatedStyle]}>
      <Pressable
        testID="add-task-fab"
        style={styles.fab}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.fabGlow} />
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

function TaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const scale = useSharedValue(1);
  const isDone = task.status === "done";

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [0.95, 1], [0.8, 1]),
  }));

  const checkboxIcon =
    isDone
      ? "checkmark-circle"
      : task.status === "in_progress"
      ? "ellipse"
      : ("ellipse-outline" as const);

  const checkboxColor = isDone ? C.success : task.status === "in_progress" ? C.accent : C.textTertiary;

  const handleLongPress = () => {
    if (Platform.OS === "web") {
      if (confirm("Delete this task?")) {
        onDelete(task.id);
      }
    } else {
      Alert.alert("Delete Task", `Delete "${task.title}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(task.id) },
      ]);
    }
  };

  const formattedDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        testID={`task-item-${task.id}`}
        style={[styles.taskCard, isDone && styles.taskCardDone]}
        onLongPress={handleLongPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 100 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      >
        <View style={[styles.taskPriorityAccent, { backgroundColor: PRIORITY_COLORS[task.priority] }]} />
        <View style={styles.taskCardInner}>
          <View style={styles.taskTopRow}>
            <Pressable
              testID={`task-toggle-${task.id}`}
              onPress={() => onToggle(task.id, nextStatus(task.status))}
              hitSlop={8}
              style={styles.checkboxHit}
            >
              <Ionicons name={checkboxIcon} size={24} color={checkboxColor} />
            </Pressable>
            <View style={styles.taskTextArea}>
              <Text
                style={[styles.taskTitle, isDone && styles.taskTitleDone]}
                numberOfLines={2}
              >
                {task.title}
              </Text>
            </View>
            <Ionicons
              name={PRIORITY_ICONS[task.priority].name}
              size={16}
              color={isDone ? C.textTertiary : PRIORITY_ICONS[task.priority].color}
            />
          </View>
          <View style={styles.taskBottomRow}>
            {task.projectName ? (
              <View style={styles.projectPill}>
                <View style={[styles.projectPillDot, { backgroundColor: C.accent }]} />
                <Text style={styles.projectPillText} numberOfLines={1}>{task.projectName}</Text>
              </View>
            ) : null}
            {formattedDate ? (
              <View style={[styles.datePill, isOverdue && styles.datePillOverdue]}>
                <Ionicons name="calendar-outline" size={12} color={isOverdue ? C.error : C.textSecondary} />
                <Text style={[styles.datePillText, isOverdue && styles.datePillTextOverdue]}>{formattedDate}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SectionHeader({
  status,
  count,
  collapsed,
  onToggle,
}: {
  status: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <Pressable testID={`section-${config.label}`} style={styles.sectionHeader} onPress={onToggle}>
      <View style={styles.sectionLeft}>
        <View style={[styles.sectionIconWrap, { backgroundColor: config.color + "18" }]}>
          <Ionicons name={config.icon} size={14} color={config.color} />
        </View>
        <Text style={styles.sectionTitle}>{config.label}</Text>
        <View style={[styles.countBadge, { backgroundColor: config.color + "18" }]}>
          <Text style={[styles.countText, { color: config.color }]}>{count}</Text>
        </View>
      </View>
      <Ionicons
        name={collapsed ? "chevron-forward" : "chevron-down"}
        size={16}
        color={C.textTertiary}
      />
    </Pressable>
  );
}

function SectionEmptyState({ status }: { status: string }) {
  const messages: Record<string, string> = {
    todo: "No tasks waiting. Add one to get started.",
    in_progress: "Nothing in progress right now.",
    done: "No completed tasks yet.",
  };
  return (
    <View style={styles.sectionEmpty}>
      <Ionicons name="remove-outline" size={14} color={C.textTertiary} />
      <Text style={styles.sectionEmptyText}>{messages[status] ?? "No tasks"}</Text>
    </View>
  );
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const isWideWeb = useIsWideWeb();
  const topPadding = Platform.OS === "web" ? (isWideWeb ? 16 : 67) : insets.top;
  const qc = useQueryClient();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true });
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newProjectId, setNewProjectId] = useState<string | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const tasksQuery = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: fetchTasks,
  });

  const projectsQuery = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: fetchProjects,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const headers = await apiHeaders();
      const res = await fetch(new URL(`/api/tasks/${id}`, getApiUrl()).toString(), {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await apiHeaders();
      const res = await fetch(new URL(`/api/tasks/${id}`, getApiUrl()).toString(), {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; priority: string; projectId: string | null }) => {
      const headers = await apiHeaders();
      const res = await fetch(new URL("/api/tasks", getApiUrl()).toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowModal(false);
      setNewTitle("");
      setNewDescription("");
      setNewPriority("medium");
      setNewProjectId(null);
    },
  });

  const handleToggle = useCallback(
    (id: string, status: string) => toggleMutation.mutate({ id, status }),
    []
  );
  const handleDelete = useCallback((id: string) => deleteMutation.mutate(id), []);

  const handleCreate = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    createMutation.mutate({ title: trimmed, priority: newPriority, projectId: newProjectId });
  };

  const tasks = tasksQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    data: tasks.filter((t) => t.status === status),
  }));

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["/api/tasks"] });
    qc.invalidateQueries({ queryKey: ["/api/projects"] });
  }, []);

  const toggleSection = (status: string) =>
    setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }));

  const selectedProject = projects.find((p) => p.id === newProjectId);

  const renderContent = () => {
    if (tasksQuery.isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      );
    }

    if (tasks.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={36} color={C.accent} />
          </View>
          <Text style={styles.emptyTitle}>No tasks yet</Text>
          <Text style={styles.emptyText}>
            Tap the button below to create your first task and start organizing your day.
          </Text>
          <Pressable style={styles.emptyCreateBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.emptyCreateBtnText}>Create Task</Text>
          </Pressable>
        </View>
      );
    }

    type ListItem =
      | { type: "header"; status: string; count: number }
      | { type: "task"; task: Task }
      | { type: "empty"; status: string };

    const listData: ListItem[] = [];
    for (const group of grouped) {
      listData.push({ type: "header", status: group.status, count: group.data.length });
      if (!collapsed[group.status]) {
        if (group.data.length === 0) {
          listData.push({ type: "empty", status: group.status });
        } else {
          for (const task of group.data) {
            listData.push({ type: "task", task });
          }
        }
      }
    }

    return (
      <FlatList
        data={listData}
        keyExtractor={(item, i) => {
          if (item.type === "header") return `h-${item.status}`;
          if (item.type === "empty") return `e-${item.status}`;
          return `t-${item.task.id}`;
        }}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return (
              <SectionHeader
                status={item.status}
                count={item.count}
                collapsed={!!collapsed[item.status]}
                onToggle={() => toggleSection(item.status)}
              />
            );
          }
          if (item.type === "empty") {
            return <SectionEmptyState status={item.status} />;
          }
          return (
            <TaskCard task={item.task} onToggle={handleToggle} onDelete={handleDelete} />
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={tasksQuery.isFetching}
            onRefresh={onRefresh}
            tintColor={C.accent}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <WebContainer maxWidth={800}>
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Tasks</Text>
            {totalTasks > 0 && (
              <Text style={styles.headerSubtitle}>
                {doneTasks} of {totalTasks} completed
              </Text>
            )}
          </View>
          {totalTasks > 0 && (
            <View style={styles.progressBarWrap}>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%` as any },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        {renderContent()}

        <AnimatedFAB
          onPress={() => setShowModal(true)}
          bottom={Platform.OS === "web" ? 34 + 16 : insets.bottom + 16}
        />

        <Modal
          visible={showModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>New Task</Text>
                <Pressable onPress={() => setShowModal(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color={C.textSecondary} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Title</Text>
                  <TextInput
                    testID="task-title-input"
                    style={styles.input}
                    placeholder="What needs to be done?"
                    placeholderTextColor={C.textTertiary}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    autoFocus
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Priority</Text>
                  <View style={styles.prioritySelector}>
                    {(["low", "medium", "high"] as const).map((p) => {
                      const isSelected = newPriority === p;
                      return (
                        <Pressable
                          testID={`priority-chip-${p}`}
                          key={p}
                          style={[
                            styles.priorityOption,
                            isSelected && { backgroundColor: PRIORITY_COLORS[p] + "1A", borderColor: PRIORITY_COLORS[p] },
                          ]}
                          onPress={() => setNewPriority(p)}
                        >
                          <Ionicons
                            name={p === "low" ? "flag-outline" : "flag"}
                            size={16}
                            color={isSelected ? PRIORITY_COLORS[p] : C.textTertiary}
                          />
                          <Text
                            style={[
                              styles.priorityOptionText,
                              isSelected && { color: PRIORITY_COLORS[p] },
                            ]}
                          >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {projects.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Project</Text>
                    <Pressable
                      style={styles.dropdownTrigger}
                      onPress={() => setShowProjectPicker(!showProjectPicker)}
                    >
                      <View style={styles.dropdownLeft}>
                        {selectedProject ? (
                          <>
                            <View style={[styles.dropdownDot, { backgroundColor: selectedProject.color }]} />
                            <Text style={styles.dropdownText}>{selectedProject.name}</Text>
                          </>
                        ) : (
                          <Text style={styles.dropdownPlaceholder}>No project</Text>
                        )}
                      </View>
                      <Ionicons
                        name={showProjectPicker ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={C.textTertiary}
                      />
                    </Pressable>
                    {showProjectPicker && (
                      <View style={styles.dropdownList}>
                        <Pressable
                          testID="project-chip-none"
                          style={[styles.dropdownItem, !newProjectId && styles.dropdownItemSelected]}
                          onPress={() => { setNewProjectId(null); setShowProjectPicker(false); }}
                        >
                          <Text style={[styles.dropdownItemText, !newProjectId && { color: C.accent }]}>No project</Text>
                        </Pressable>
                        {projects.map((proj) => (
                          <Pressable
                            testID={`project-chip-${proj.id}`}
                            key={proj.id}
                            style={[styles.dropdownItem, newProjectId === proj.id && styles.dropdownItemSelected]}
                            onPress={() => { setNewProjectId(proj.id); setShowProjectPicker(false); }}
                          >
                            <View style={[styles.dropdownDot, { backgroundColor: proj.color }]} />
                            <Text
                              style={[
                                styles.dropdownItemText,
                                newProjectId === proj.id && { color: C.accent },
                              ]}
                              numberOfLines={1}
                            >
                              {proj.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <Pressable
                  testID="create-task-button"
                  style={[styles.createBtn, !newTitle.trim() && styles.createBtnDisabled]}
                  onPress={handleCreate}
                  disabled={!newTitle.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={styles.createBtnInner}>
                      <Ionicons name="add-circle" size={20} color="#fff" />
                      <Text style={styles.createBtnText}>Create Task</Text>
                    </View>
                  )}
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
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
  progressBarWrap: {
    marginTop: 12,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 2,
    overflow: "hidden" as const,
  },
  progressBarFill: {
    height: 3,
    backgroundColor: C.success,
    borderRadius: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    letterSpacing: 0.1,
  },
  countBadge: {
    borderRadius: 10,
    minWidth: 22,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  countText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  sectionEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  sectionEmptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
    fontStyle: "italic" as const,
  },
  taskCard: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 14,
    marginBottom: 8,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: C.border,
  },
  taskCardDone: {
    opacity: 0.6,
  },
  taskPriorityAccent: {
    width: 4,
  },
  taskCardInner: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  taskTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkboxHit: {
    paddingTop: 1,
  },
  taskTextArea: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: C.text,
    lineHeight: 21,
  },
  taskTitleDone: {
    textDecorationLine: "line-through" as const,
    color: C.textTertiary,
  },
  taskBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 36,
  },
  projectPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  projectPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  projectPillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
    maxWidth: 120,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  datePillOverdue: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  datePillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  datePillTextOverdue: {
    color: C.error,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accent + "14",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
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
    textAlign: "center",
    lineHeight: 21,
  },
  emptyCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyCreateBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  fabContainer: {
    position: "absolute",
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    overflow: "hidden" as const,
  },
  fabGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: Platform.OS === "web" ? "center" : "flex-end",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    padding: Platform.OS === "web" ? 20 : 0,
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...(Platform.OS === "web"
      ? { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, maxWidth: 480, width: "100%" as any }
      : {}),
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "web" ? 28 : 44,
    paddingTop: 12,
    maxHeight: "85%" as any,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.textTertiary,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  inputGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  prioritySelector: {
    flexDirection: "row",
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  priorityOptionText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dropdownText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: C.text,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  dropdownList: {
    marginTop: 4,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden" as const,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  dropdownItemSelected: {
    backgroundColor: C.accent + "0D",
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.text,
  },
  createBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  createBtnDisabled: {
    opacity: 0.35,
  },
  createBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  createBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
