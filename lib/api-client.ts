import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import { getApiUrl } from "@/lib/query-client";
import { DEVICE_ID_KEY } from "@/components/chat/types";
import type {
  Message,
  Citation,
  Confidence,
  ActionItem,
  DocumentRequest,
  BriefData,
  ChatMode,
  ExplainLevel,
} from "@shared/schema";

/**
 * Centralized API client for Aura.
 * All server communication goes through here — no scattered fetch calls.
 * Handles device ID, headers, and error handling consistently.
 */

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  cachedDeviceId = id;
  return id;
}

async function headers(includeContentType = true): Promise<Record<string, string>> {
  const deviceId = await getDeviceId();
  const h: Record<string, string> = { "x-device-id": deviceId };
  if (includeContentType) h["Content-Type"] = "application/json";
  return h;
}

function apiUrl(path: string): string {
  return new URL(path, getApiUrl()).toString();
}

// ─── Messages ────────────────────────────────────────────────────────────

export async function fetchMessages(): Promise<any[]> {
  const h = await headers();
  const res = await fetch(apiUrl("/api/messages"), { headers: h });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ─── Memories ────────────────────────────────────────────────────────────

export async function fetchMemories(): Promise<any[]> {
  const h = await headers();
  const res = await global.fetch(apiUrl("/api/memories"), { headers: h });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function addMemoryApi(text: string, category: string = "context"): Promise<any> {
  const h = await headers();
  const res = await global.fetch(apiUrl("/api/memories"), {
    method: "POST",
    headers: h,
    body: JSON.stringify({ text, category }),
  });
  if (!res.ok) throw new Error("Failed to add memory");
  return res.json();
}

export async function deleteMemoryApi(id: string): Promise<void> {
  const h = await headers();
  await global.fetch(apiUrl(`/api/memories/${id}`), { method: "DELETE", headers: h });
}

export async function deleteAllMemoriesApi(): Promise<void> {
  const h = await headers();
  await global.fetch(apiUrl("/api/memories"), { method: "DELETE", headers: h });
}

// ─── Brief ───────────────────────────────────────────────────────────────

export async function fetchBrief(recentMessages: { role: string; content: string }[]): Promise<BriefData | null> {
  try {
    const h = await headers();
    const res = await global.fetch(apiUrl("/api/brief"), {
      method: "POST",
      headers: h,
      body: JSON.stringify({ recentMessages }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Chat (streaming) ───────────────────────────────────────────────────

export interface ChatStreamCallbacks {
  onContent: (content: string) => void;
  onConfidence: (confidence: Confidence, reason: string) => void;
  onCitations: (citations: Citation[]) => void;
  onDocumentRequest: (request: DocumentRequest) => void;
  onActionItems: (items: ActionItem[]) => void;
  onMode: (mode: ChatMode) => void;
  onModelTier: (tier: string) => void;
  onAttachmentContext: (attachments: any[]) => void;
  onDone: (fullContent: string) => void;
  onError: (error: Error) => void;
}

export async function streamChat(
  options: {
    messages: { role: string; content: string }[];
    mode: ChatMode;
    explainLevel: ExplainLevel;
    isPrivate: boolean;
    autoDetectMode: boolean;
    attachments?: { uri: string; name: string; type: string }[];
  },
  callbacks: ChatStreamCallbacks
): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    const url = apiUrl("/api/chat");

    let response: Response;
    if (options.attachments && options.attachments.length > 0) {
      const formData = new FormData();
      formData.append("messages", JSON.stringify(options.messages));
      formData.append("mode", options.mode);
      formData.append("explainLevel", options.explainLevel);
      formData.append("isPrivate", String(options.isPrivate));
      formData.append("rememberFlag", String(!options.isPrivate));
      formData.append("autoDetectMode", String(options.autoDetectMode));

      for (const att of options.attachments) {
        formData.append("attachments", { uri: att.uri, name: att.name, type: att.type } as any);
      }

      response = await fetch(url, {
        method: "POST",
        headers: { "x-device-id": deviceId, Accept: "text/event-stream" },
        body: formData as any,
      });
    } else {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId, Accept: "text/event-stream" },
        body: JSON.stringify({
          messages: options.messages,
          mode: options.mode,
          explainLevel: options.explainLevel,
          isPrivate: options.isPrivate,
          rememberFlag: !options.isPrivate,
          autoDetectMode: options.autoDetectMode,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Chat request failed (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "confidence") {
            callbacks.onConfidence(parsed.confidence, parsed.confidenceReason || "");
          } else if (parsed.type === "citations") {
            callbacks.onCitations(parsed.citations || []);
          } else if (parsed.type === "document_request") {
            callbacks.onDocumentRequest(parsed.documentRequest);
          } else if (parsed.type === "action_items") {
            callbacks.onActionItems(parsed.actionItems || []);
          } else if (parsed.type === "mode") {
            callbacks.onMode(parsed.mode);
          } else if (parsed.type === "model_tier") {
            callbacks.onModelTier(parsed.tier);
          } else if (parsed.type === "attachment_context") {
            callbacks.onAttachmentContext(parsed.attachments);
          } else if (parsed.content) {
            fullContent += parsed.content;
            callbacks.onContent(fullContent);
          }
        } catch {}
      }
    }

    callbacks.onDone(fullContent);
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

// ─── Tasks ───────────────────────────────────────────────────────────────

export async function fetchTasks(filters?: { status?: string; projectId?: string }): Promise<any[]> {
  const h = await headers();
  let path = "/api/tasks";
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.projectId) params.set("project_id", filters.projectId);
  const qs = params.toString();
  if (qs) path += `?${qs}`;
  const res = await fetch(apiUrl(path), { headers: h });
  if (!res.ok) return [];
  return res.json();
}

export async function createTaskApi(data: { title: string; description?: string; priority?: string; projectId?: string }): Promise<any> {
  const h = await headers();
  const res = await fetch(apiUrl("/api/tasks"), { method: "POST", headers: h, body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to create task");
  return res.json();
}

export async function updateTaskApi(id: string, updates: Record<string, any>): Promise<any> {
  const h = await headers();
  const res = await fetch(apiUrl(`/api/tasks/${id}`), { method: "PATCH", headers: h, body: JSON.stringify(updates) });
  if (!res.ok) throw new Error("Failed to update task");
  return res.json();
}

export async function deleteTaskApi(id: string): Promise<void> {
  const h = await headers();
  await fetch(apiUrl(`/api/tasks/${id}`), { method: "DELETE", headers: h });
}

// ─── Projects ────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<any[]> {
  const h = await headers();
  const res = await fetch(apiUrl("/api/projects"), { headers: h });
  if (!res.ok) return [];
  return res.json();
}

export async function createProjectApi(data: { name: string; description?: string }): Promise<any> {
  const h = await headers();
  const res = await fetch(apiUrl("/api/projects"), { method: "POST", headers: h, body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function updateProjectApi(id: string, updates: Record<string, any>): Promise<any> {
  const h = await headers();
  const res = await fetch(apiUrl(`/api/projects/${id}`), { method: "PATCH", headers: h, body: JSON.stringify(updates) });
  if (!res.ok) throw new Error("Failed to update project");
  return res.json();
}

export async function deleteProjectApi(id: string): Promise<void> {
  const h = await headers();
  await fetch(apiUrl(`/api/projects/${id}`), { method: "DELETE", headers: h });
}

// ─── Today ───────────────────────────────────────────────────────────────

export async function fetchToday(): Promise<any> {
  const h = await headers();
  const res = await fetch(apiUrl("/api/today"), { headers: h });
  if (!res.ok) return { plan: null, tasks: [] };
  return res.json();
}

export async function generateTodayPlan(): Promise<any> {
  const h = await headers();
  const res = await fetch(apiUrl("/api/today/generate"), { method: "POST", headers: h });
  if (!res.ok) throw new Error("Failed to generate plan");
  return res.json();
}
