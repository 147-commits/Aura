/**
 * Shared types used by both client and server.
 * No ORM dependency — these are pure TypeScript interfaces.
 */

// ─── User ────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  device_id: string;
  created_at: string;
}

// ─── Memory ──────────────────────────────────────────────────────────────
export interface MemoryItem {
  id: string;
  text: string;
  category: "preference" | "goal" | "project" | "constraint" | "context";
  confidence: "High" | "Medium" | "Low";
  createdAt: string;
}

// ─── Messages ────────────────────────────────────────────────────────────
export type ChatMode = "chat" | "research" | "decision" | "brainstorm" | "explain";
export type ExplainLevel = "simple" | "normal" | "expert";
export type Confidence = "High" | "Medium" | "Low";
export type MessageType = "text" | "brief" | "memory-prompt" | "wrap-up";

export interface Citation {
  url: string;
  title: string;
  snippet: string;
}

export interface BriefData {
  reflection: string;
  pattern: string;
  action: string;
  period: string;
}

export interface DocumentRequest {
  type: "pdf" | "docx";
  title: string;
  filename: string;
  sections: { heading: string; content_markdown: string }[];
  tables?: { title: string; columns: string[]; rows: string[][] }[];
  sources?: { title: string; url: string }[];
}

// ─── Crafts ─────────────────────────────────────────────────────────────
export type CraftKind =
  | "pdf" | "docx" | "pptx" | "xlsx"
  | "html" | "react" | "svg"
  | "markdown" | "code";

export interface CraftSlide {
  master: "title" | "content" | "two-column" | "image-text" | "closing";
  title?: string;
  body?: string;
  bullets?: string[];
  imageUrl?: string;
  leftContent?: string;
  rightContent?: string;
}

export interface CraftSheet {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  rows: Record<string, string | number>[];
  formulas?: { cell: string; formula: string }[];
}

export interface CraftRequest {
  kind: CraftKind;
  title: string;
  filename?: string;
  sections?: { heading: string; content_markdown: string }[];
  slides?: CraftSlide[];
  sheets?: CraftSheet[];
  content?: string;
  language?: string;
  tables?: { title: string; columns: string[]; rows: string[][] }[];
  sources?: { title: string; url: string }[];
  conversationId?: string;
}

export interface Craft {
  id: string;
  userId: string;
  conversationId?: string;
  kind: CraftKind;
  title: string;
  content?: string;
  filePath?: string;
  filename: string;
  createdAt: string;
}

export interface CraftResult {
  craft: Craft;
  content?: string;
  downloadUrl?: string;
}

export interface ActionItem {
  type: "task" | "project" | "memory" | "decision";
  title: string;
  description: string;
  priority?: "high" | "medium" | "low";
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: MessageType;
  mode?: ChatMode;
  confidence?: Confidence;
  confidenceReason?: string;
  citations?: Citation[];
  isPrivate?: boolean;
  timestamp: number;
  briefData?: BriefData;
  replyTo?: { id: string; content: string; role: "user" | "assistant" };
  documentRequest?: DocumentRequest;
  attachments?: { name: string; type: string }[];
  actionItems?: ActionItem[];
}

// ─── Tasks ───────────────────────────────────────────────────────────────
export interface Task {
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

// ─── Projects ────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed";
  color: string;
  taskCount?: number;
  completedTaskCount?: number;
  createdAt: string;
}

// ─── Daily Plan ──────────────────────────────────────────────────────────
export interface DailyPlan {
  id: string;
  date: string;
  summary: string;
  taskIds: string[];
  createdAt: string;
}

// ─── Skills ─────────────────────────────────────────────────────────────
export type SkillDomain =
  | "engineering"
  | "marketing"
  | "product"
  | "finance"
  | "leadership"
  | "operations";

export interface SkillSummary {
  id: string;
  name: string;
  domain: SkillDomain;
  icon: string;
  description: string;
}

// ─── Chat Request ───────────────────────────────────────────────────────
export interface ChatRequest {
  message: string;
  mode?: ChatMode;
  explainLevel?: ExplainLevel;
  isPrivate?: boolean;
  activeSkillId?: string;
}

// ─── Builder ────────────────────────────────────────────────────────────
export type BuilderProjectType = "website" | "mobile-app";

export interface BuilderProject {
  id: string;
  userId: string;
  type: BuilderProjectType;
  name: string;
  files: Record<string, string>;
  currentHtml?: string;
  deployUrl?: string;
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuilderGenerateRequest {
  projectId?: string;
  prompt: string;
  type?: BuilderProjectType;
  name?: string;
}

// ─── API Response Types ──────────────────────────────────────────────────
export interface ApiError {
  error: string;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
}
