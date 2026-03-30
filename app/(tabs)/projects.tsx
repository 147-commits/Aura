import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  FadeIn,
  FadeInDown,
  interpolate,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { useIsWideWeb } from "@/components/WebContainer";
import { fetch } from "expo/fetch";
import WebContainer from "@/components/WebContainer";
const C = Colors.dark;
const DEVICE_ID_KEY = "aura:device_id";

const PROJECT_COLORS = [
  "#3B82F6",
  "#06B6D4",
  "#8B5CF6",
  "#14B8A6",
  "#F59E0B",
];

interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed";
  color: string;
  taskCount?: number;
  completedTaskCount?: number;
  createdAt: string;
}

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

function apiHeaders(deviceId: string) {
  return { "Content-Type": "application/json", "x-device-id": deviceId };
}

const STATUS_META: Record<string, { color: string; label: string; icon: string }> = {
  active: { color: "#10B981", label: "Active", icon: "play-circle-outline" },
  paused: { color: "#F59E0B", label: "Paused", icon: "pause-circle-outline" },
  completed: { color: "#8B90A8", label: "Done", icon: "checkmark-circle-outline" },
};

const STATUS_CYCLE: Record<string, "active" | "paused" | "completed"> = {
  active: "paused",
  paused: "completed",
  completed: "active",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#8B90A8",
};

function TaskItem({ task, onToggle }: { task: Task; onToggle?: (id: string) => void }) {
  const isDone = task.status === "done";
  const priorityColor = PRIORITY_COLORS[task.priority] || "#8B90A8";

  return (
    <TouchableOpacity
      style={taskStyles.container}
      activeOpacity={0.7}
      onPress={() => onToggle?.(task.id)}
    >
      <View style={[taskStyles.checkbox, isDone && { borderColor: C.success, backgroundColor: C.success + "20" }]}>
        {isDone && <Ionicons name="checkmark" size={12} color={C.success} />}
      </View>
      <View style={taskStyles.content}>
        <Text
          style={[taskStyles.title, isDone && taskStyles.titleDone]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <View style={[taskStyles.priorityPill, { backgroundColor: priorityColor + "18" }]}>
          <View style={[taskStyles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={[taskStyles.priorityText, { color: priorityColor }]}>
            {task.priority}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ProgressBar({ total, completed, color }: { total: number; completed: number; color: string }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <View style={progressStyles.track}>
      <View style={[progressStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function ProjectCard({
  project,
  deviceId,
  onStatusChange,
  onDelete,
  onRefresh,
}: {
  project: Project;
  deviceId: string;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [submittingTask, setSubmittingTask] = useState(false);
  const expandHeight = useSharedValue(0);
  const chevronRotation = useSharedValue(0);

  const animatedExpandStyle = useAnimatedStyle(() => ({
    height: expandHeight.value,
    opacity: interpolate(expandHeight.value, [0, 30], [0, 1]),
    overflow: "hidden" as const,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const statusMeta = STATUS_META[project.status];
  const totalTasks = project.taskCount ?? 0;
  const completedTasks = project.completedTaskCount ?? 0;

  const toggleExpand = useCallback(async () => {
    const willExpand = !expanded;
    setExpanded(willExpand);

    if (willExpand) {
      chevronRotation.value = withTiming(180, { duration: 300 });
      expandHeight.value = withTiming(200, { duration: 300 });
      setLoadingTasks(true);
      try {
        const baseUrl = getApiUrl();
        const url = new URL(`/api/tasks?project_id=${project.id}`, baseUrl);
        const res = await fetch(url.toString(), {
          headers: { "x-device-id": deviceId },
        });
        if (res.ok) {
          const data = await res.json();
          setTasks(data);
          const targetHeight = Math.max(120, data.length * 52 + 80);
          expandHeight.value = withTiming(targetHeight, { duration: 200 });
        }
      } catch {
      } finally {
        setLoadingTasks(false);
      }
    } else {
      chevronRotation.value = withTiming(0, { duration: 300 });
      expandHeight.value = withTiming(0, { duration: 250 });
      setAddingTask(false);
      setNewTaskTitle("");
    }
  }, [expanded, project.id, deviceId]);

  const handleLongPress = useCallback(() => {
    if (Platform.OS === "web") {
      if (confirm(`Delete project "${project.name}"?`)) {
        onDelete(project.id);
      }
    } else {
      Alert.alert(
        "Delete Project",
        `Are you sure you want to delete "${project.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => onDelete(project.id),
          },
        ],
      );
    }
  }, [project.id, project.name, onDelete]);

  const handleStatusToggle = useCallback(() => {
    const next = STATUS_CYCLE[project.status];
    onStatusChange(project.id, next);
  }, [project.id, project.status, onStatusChange]);

  const handleAddTask = useCallback(async () => {
    if (!newTaskTitle.trim() || !deviceId) return;
    setSubmittingTask(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/tasks", baseUrl);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: apiHeaders(deviceId),
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          projectId: project.id,
          priority: "medium",
          status: "todo",
        }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [...prev, task]);
        setNewTaskTitle("");
        setAddingTask(false);
        const targetHeight = Math.max(120, (tasks.length + 1) * 52 + 80);
        expandHeight.value = withTiming(targetHeight, { duration: 200 });
        onRefresh();
      }
    } catch {
    } finally {
      setSubmittingTask(false);
    }
  }, [newTaskTitle, deviceId, project.id, tasks.length, onRefresh]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={toggleExpand}
      onLongPress={handleLongPress}
      testID={`project-card-${project.id}`}
      style={styles.cardOuter}
    >
      <View style={[styles.cardGradientBorder, { borderColor: project.color + "30" }]}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.cardColorDot, { backgroundColor: project.color }]} />
              <Text style={styles.cardName} numberOfLines={1}>
                {project.name}
              </Text>
              <TouchableOpacity
                onPress={handleStatusToggle}
                testID={`project-status-${project.id}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusMeta.color + "15", borderColor: statusMeta.color + "30" },
                  ]}
                >
                  <Ionicons
                    name={statusMeta.icon as any}
                    size={14}
                    color={statusMeta.color}
                  />
                  <Text style={[styles.statusText, { color: statusMeta.color }]}>
                    {statusMeta.label}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {project.description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {project.description}
              </Text>
            ) : null}

            <View style={styles.cardFooter}>
              <View style={styles.taskMeta}>
                <Ionicons name="layers-outline" size={14} color={C.textSecondary} />
                <Text style={styles.taskCount}>
                  {completedTasks}/{totalTasks} tasks
                </Text>
              </View>
              {totalTasks > 0 && (
                <View style={styles.progressContainer}>
                  <ProgressBar total={totalTasks} completed={completedTasks} color={project.color} />
                </View>
              )}
              <Animated.View style={chevronStyle}>
                <Ionicons name="chevron-down" size={16} color={C.textTertiary} />
              </Animated.View>
            </View>
          </View>

          <Animated.View style={animatedExpandStyle}>
            <View style={styles.tasksContainer}>
              {loadingTasks ? (
                <ActivityIndicator
                  size="small"
                  color={C.accent}
                  style={{ marginTop: 12 }}
                />
              ) : tasks.length === 0 && !addingTask ? (
                <View style={styles.noTasksContainer}>
                  <Text style={styles.noTasks}>No tasks yet</Text>
                </View>
              ) : (
                tasks.map((task) => <TaskItem key={task.id} task={task} onToggle={async (id) => {
                  const nextStatus = task.status === "done" ? "todo" : task.status === "in_progress" ? "done" : "in_progress";
                  setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: nextStatus } : t));
                  try {
                    const baseUrl = getApiUrl();
                    const url = new URL(`/api/tasks/${id}`, baseUrl);
                    await fetch(url.toString(), {
                      method: "PATCH",
                      headers: apiHeaders(deviceId),
                      body: JSON.stringify({ status: nextStatus }),
                    });
                  } catch {}
                }} />)
              )}

              {addingTask ? (
                <View style={styles.addTaskInputRow}>
                  <TextInput
                    style={styles.addTaskInput}
                    placeholder="Task name..."
                    placeholderTextColor={C.textTertiary}
                    value={newTaskTitle}
                    onChangeText={setNewTaskTitle}
                    autoFocus
                    onSubmitEditing={handleAddTask}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={handleAddTask}
                    disabled={!newTaskTitle.trim() || submittingTask}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {submittingTask ? (
                      <ActivityIndicator size="small" color={C.accent} />
                    ) : (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={newTaskTitle.trim() ? C.accent : C.textTertiary}
                      />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setAddingTask(false); setNewTaskTitle(""); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={20} color={C.textTertiary} />
                  </TouchableOpacity>
                </View>
              ) : expanded ? (
                <TouchableOpacity
                  style={styles.addTaskButton}
                  onPress={() => {
                    setAddingTask(true);
                    const newHeight = Math.max(180, tasks.length * 52 + 140);
                    expandHeight.value = withTiming(newHeight, { duration: 200 });
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color={C.accent} />
                  <Text style={styles.addTaskButtonText}>Add Task</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const isWideWeb = useIsWideWeb();
  const topPadding = Platform.OS === "web" ? (isWideWeb ? 16 : 67) : insets.top;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState(PROJECT_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  const loadDeviceId = useCallback(async () => {
    const id = (await AsyncStorage.getItem(DEVICE_ID_KEY)) || "";
    setDeviceId(id);
    return id;
  }, []);

  const fetchProjects = useCallback(
    async (devId?: string) => {
      const id = devId || deviceId;
      if (!id) return;
      try {
        const baseUrl = getApiUrl();
        const url = new URL("/api/projects", baseUrl);
        const res = await fetch(url.toString(), {
          headers: { "x-device-id": id },
        });
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch {
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [deviceId],
  );

  useEffect(() => {
    (async () => {
      const id = await loadDeviceId();
      if (id) await fetchProjects(id);
      else setLoading(false);
    })();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = useCallback(async () => {
    if (!formName.trim() || !deviceId) return;
    setSubmitting(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/projects", baseUrl);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: apiHeaders(deviceId),
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim(),
          color: formColor,
        }),
      });
      if (res.ok) {
        setFormName("");
        setFormDesc("");
        setFormColor(PROJECT_COLORS[0]);
        setShowForm(false);
        await fetchProjects();
      }
    } catch {
    } finally {
      setSubmitting(false);
    }
  }, [formName, formDesc, formColor, deviceId, fetchProjects]);

  const handleStatusChange = useCallback(
    async (projectId: string, status: string) => {
      if (!deviceId) return;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, status: status as Project["status"] }
            : p,
        ),
      );
      try {
        const baseUrl = getApiUrl();
        const url = new URL(`/api/projects/${projectId}`, baseUrl);
        await fetch(url.toString(), {
          method: "PATCH",
          headers: apiHeaders(deviceId),
          body: JSON.stringify({ status }),
        });
      } catch {
        fetchProjects();
      }
    },
    [deviceId, fetchProjects],
  );

  const handleDelete = useCallback(
    async (projectId: string) => {
      if (!deviceId) return;
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      try {
        const baseUrl = getApiUrl();
        const url = new URL(`/api/projects/${projectId}`, baseUrl);
        await fetch(url.toString(), {
          method: "DELETE",
          headers: apiHeaders(deviceId),
        });
      } catch {
        fetchProjects();
      }
    },
    [deviceId, fetchProjects],
  );

  const renderProject = useCallback(
    ({ item }: { item: Project }) => (
      <ProjectCard
        project={item}
        deviceId={deviceId}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onRefresh={onRefresh}
      />
    ),
    [deviceId, handleStatusChange, handleDelete, onRefresh],
  );

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconOuter}>
          <View style={styles.emptyIconInner}>
            <MaterialCommunityIcons name="folder-plus-outline" size={28} color={C.accent} />
          </View>
        </View>
        <Text style={styles.emptyTitle}>No projects yet</Text>
        <Text style={styles.emptyText}>
          Your projects will appear here. Create one to start organizing your work.
        </Text>
        <TouchableOpacity
          style={styles.emptyCreateButton}
          onPress={() => setShowForm(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.emptyCreateText}>Create Project</Text>
        </TouchableOpacity>
      </View>
    );
  }, [loading]);

  return (
    <WebContainer maxWidth={800}>
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Projects</Text>
            <Text style={styles.headerSubtitle}>
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            testID="add-project-button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerAddButton}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        ) : (
          <FlatList
            data={projects}
            keyExtractor={(item) => item.id}
            renderItem={renderProject}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              projects.length === 0 && styles.listEmpty,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={C.accent}
              />
            }
            showsVerticalScrollIndicator={false}
            testID="projects-list"
          />
        )}

        <Modal
          visible={showForm}
          animationType="slide"
          transparent
          onRequestClose={() => setShowForm(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowForm(false)}
          >
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Project</Text>
                <TouchableOpacity
                  onPress={() => setShowForm(false)}
                  testID="close-form-button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={24} color={C.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Website Redesign"
                  placeholderTextColor={C.textTertiary}
                  value={formName}
                  onChangeText={setFormName}
                  autoFocus
                  testID="project-name-input"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="What is this project about?"
                  placeholderTextColor={C.textTertiary}
                  value={formDesc}
                  onChangeText={setFormDesc}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  testID="project-description-input"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Color</Text>
                <View style={styles.colorPicker}>
                  {PROJECT_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setFormColor(color)}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        formColor === color && styles.colorOptionSelected,
                      ]}
                    >
                      {formColor === color && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.createButton,
                  { backgroundColor: formColor },
                  (!formName.trim() || submitting) && styles.createButtonDisabled,
                ]}
                onPress={handleCreate}
                disabled={!formName.trim() || submitting}
                testID="create-project-button"
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={18} color="#fff" />
                    <Text style={styles.createButtonText}>Create Project</Text>
                  </>
                )}
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </WebContainer>
  );
}

const progressStyles = StyleSheet.create({
  track: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
});

const taskStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.text,
    flex: 1,
    marginRight: 8,
  },
  titleDone: {
    textDecorationLine: "line-through",
    color: C.textTertiary,
  },
  priorityPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  priorityDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    color: C.textTertiary,
    marginTop: 2,
  },
  headerAddButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  listEmpty: {
    flex: 1,
  },
  cardOuter: {
    borderRadius: 16,
  },
  cardGradientBorder: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 15,
    padding: 16,
  },
  cardHeader: {
    gap: 10,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  cardDescription: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 18,
    marginLeft: 20,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  taskCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  tasksContainer: {
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 8,
  },
  noTasksContainer: {
    paddingVertical: 12,
    alignItems: "center",
  },
  noTasks: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textTertiary,
  },
  addTaskButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  addTaskButtonText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.accent,
  },
  addTaskInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  addTaskInput: {
    flex: 1,
    backgroundColor: C.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIconOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accentGlow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyIconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accentGlowStrong,
    alignItems: "center",
    justifyContent: "center",
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
    lineHeight: 21,
  },
  emptyCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyCreateText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: Platform.OS === "web" ? "center" : "flex-end",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    padding: Platform.OS === "web" ? 20 : 0,
  },
  modalContent: {
    backgroundColor: C.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...(Platform.OS === "web"
      ? {
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          maxWidth: 480,
          width: "100%" as any,
        }
      : {}),
    padding: 24,
    paddingBottom: Platform.OS === "web" ? 24 : 44,
    gap: 20,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.borderLight,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
    letterSpacing: -0.3,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
    marginLeft: 2,
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: 14,
  },
  colorPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  colorOptionSelected: {
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  createButton: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});
