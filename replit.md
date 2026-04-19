# Aura — Truth-First AI Productivity Companion (Stage 3)

## Three-Pillar Architecture

Aura is the AI companion that knows you, tells you the truth, and can spin up a virtual company to ship what you're dreaming about. The product is built on three load-bearing pillars: a **Truth-First Engine** (the operating principle — confidence ratings, intent matching, anti-hallucination, anti-sycophancy, privacy) that governs every surface, a **Personal Companion** (always-free daily chat, encrypted memory, tasks, daily plans) that compounds over time, and a **Virtual Company Engine** (paid — 12 agents across 5 phases producing a working app preview plus a governance bundle of PRD, ADRs, test plan, threat model, deployment runbook, and GTM brief).

Dropping any pillar weakens the product. Truth-First without the Companion is a better ChatGPT. The Companion without Truth-First is another chatbot that lies prettily. The pipeline without the Companion is v0 / Bolt / Lovable — a cold-start commodity. All three together are Aura.

**Canonical reference:** [`docs/PRODUCT_IDENTITY.md`](docs/PRODUCT_IDENTITY.md) — single source of truth for product definition, non-negotiables, anti-identity, wedge customer, design principles, and success metrics.

## Overview

Aura is a truth-first, privacy-first AI thinking partner and productivity companion built with Expo React Native. Stage 2 extends the chat with tab-based navigation, AI-powered action extraction, task/project management, and daily planning. Core principle: **one input, many outcomes** — the user types naturally and Aura detects tasks, projects, decisions, and context automatically.

## Architecture

### Frontend (Expo / React Native)
- **Framework**: Expo SDK 54, Expo Router (file-based routing)
- **Port**: 8081 (dev server)
- **Routing**: Tab-based navigation with 5 tabs
  - `/` — Welcome/onboarding screen (one-time, routes to `/(tabs)/aura`)
  - `/(tabs)/aura` — Main chat experience (Aura tab)
  - `/(tabs)/today` — Today's plan + priorities
  - `/(tabs)/projects` — Project workspaces
  - `/(tabs)/tasks` — Task list (grouped: To Do, In Progress, Done)
  - `/(tabs)/memory` — Memory management + trust controls

### Backend (Express / Node.js)
- **Port**: 5000
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2 for chat, gpt-4o-mini for research)
- **Database**: PostgreSQL (Replit built-in)
- **Encryption**: AES-256-GCM (Node.js crypto, key from SESSION_SECRET)

## Server Modules

### server/db.ts
PostgreSQL connection pool + typed `query()` / `queryOne()` helpers.

### server/encryption.ts
AES-256-GCM encrypt/decrypt for messages and memories at rest. Key derived from `SESSION_SECRET` via scrypt.

### server/truth-engine.ts
- `buildTruthSystemPrompt(mode, explainLevel, memory, { isTriage? })` — builds mode-specific system prompts
- `parseConfidence(content)` — extracts Confidence: High|Medium|Low (reason) from response, returns `{ cleanContent, confidence, confidenceReason }`
- `parseDocumentRequest(content)` — extracts |||DOCUMENT_REQUEST||| JSON from response
- `parseActionItems(content)` — extracts |||ACTION_ITEMS||| JSON array from response
- `detectMode(message, openai)` — auto-classifies user intent to ChatMode
- `detectStressSignals(message)` — detects stress/overwhelm keywords for Calm Triage System
- Answer shape matching: A-H format templates
- Action detection: AI appends |||ACTION_ITEMS|||[...] when actionable items detected
- Document export: AI appends |||DOCUMENT_REQUEST|||{JSON} when user requests PDF/DOCX
- Calm Triage: When stress detected, instructs AI to respond with top 3 priorities + next step only

### server/research-engine.ts
- `runResearch(query, openai, memory)` — uses OpenAI Responses API with `web_search_preview` tool
- Falls back to gpt-5.2 knowledge if Responses API unavailable

### server/document-engine.ts
- `generatePDF(request)` — generates PDF from DocumentRequest using pdfkit

### server/memory-engine.ts
- `getOrCreateUser(deviceId)` — device-based user management
- `getMemories()` / `addMemory()` / `deleteMemory()` / `deleteAllMemories()`
- `extractAndSaveMemories(userId, message, openai)` — extracts preference/goal/project/constraint memories
- `saveMessage()` — encrypted message persistence
- Memory categories: preference, goal, project, constraint

### server/productivity-engine.ts
- **Tasks CRUD**: `createTask()`, `getTasks()`, `updateTask()`, `deleteTask()`
- **Projects CRUD**: `createProject()`, `getProjects()`, `updateProject()`, `deleteProject()`
- **Daily Plans**: `getDailyPlan()`, `generateDailyPlan(userId, openai)` — AI-powered daily planning
- **Action Extraction**: `extractActionItems(message, response, openai)` — detects tasks/projects/memories from conversation
- All text fields encrypted at rest (AES-256-GCM)
- Tasks sorted by priority (high→medium→low)

### server/file-engine.ts
- `processAttachment(buffer, mimetype, filename)` — images → base64, PDFs → pdf-parse, DOCX → mammoth, CSV → structured text
- `buildAttachmentContext(attachments)` — builds combined context string for AI prompt

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/health | Health check |
| POST | /api/chat | Streaming SSE chat with action_items/confidence/citations/document_request |
| POST | /api/research | Non-streaming research shortcut |
| POST | /api/export | Generate PDF from DocumentRequest JSON |
| GET | /api/messages | Get conversation history for device |
| GET | /api/memories | List memories for device |
| POST | /api/memories | Create memory |
| DELETE | /api/memories/:id | Delete memory |
| DELETE | /api/memories | Delete all memories |
| POST | /api/extract-memory | Extract memory-worthy items |
| POST | /api/brief | Generate daily brief |
| GET | /api/tasks | List tasks (filterable: ?status=&project_id=) |
| POST | /api/tasks | Create task |
| PATCH | /api/tasks/:id | Update task |
| DELETE | /api/tasks/:id | Delete task |
| GET | /api/projects | List projects |
| POST | /api/projects | Create project |
| PATCH | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete project |
| GET | /api/today | Get today's plan + pending tasks |
| POST | /api/today/generate | AI-generate daily plan |
| POST | /api/extract-actions | Extract action items from message pair |

## Database Schema

```sql
users (id UUID, device_id TEXT UNIQUE, created_at, updated_at)
conversations (id UUID, user_id UUID FK, title, created_at, updated_at)
messages (id UUID, conversation_id UUID FK, role, content, content_encrypted BOOL, 
          type, mode, confidence, explain_level, remember_flag, is_private, metadata JSON, created_at)
memories (id UUID, user_id UUID FK, text, text_encrypted BOOL, category, confidence, created_at, updated_at)
citations (id UUID, message_id UUID FK, url, title, snippet, created_at)
projects (id UUID, user_id UUID FK, name, description, description_encrypted BOOL, 
          status [active/paused/completed], color TEXT, created_at, updated_at)
tasks (id UUID, user_id UUID FK, title, title_encrypted BOOL, description, description_encrypted BOOL,
       status [todo/in_progress/done], priority [high/medium/low], due_date DATE,
       project_id UUID FK nullable, source_message_id UUID nullable, created_at, updated_at)
daily_plans (id UUID, user_id UUID FK, plan_date DATE, summary, summary_encrypted BOOL,
             task_ids JSONB, created_at, UNIQUE(user_id, plan_date))
```

## Non-Negotiables (Enforced)

1. **No hallucination**: Every response ends with `Confidence: High|Medium|Low`
2. **Evidence-first**: Research mode uses web search + structured report format
3. **Adaptive answer shapes**: AI auto-picks format (A-H) based on user intent
4. **Memory control**: Per-message `remember_flag` and `is_private`; full CRUD API
5. **Privacy**: Private messages never stored to DB; memories encrypted AES-256-GCM at rest
6. **Chat persistence**: Messages stored in DB + AsyncStorage; restored from server
7. **Action extraction**: AI detects tasks/projects/decisions from natural conversation

## Stage 2 Features

### Conversation-to-Action Engine
- AI detects actionable items (tasks, projects, decisions) from chat
- Inline action cards appear below assistant messages
- One-tap to accept: creates task, project, or memory
- Dismissible cards

### Today View (/(tabs)/today)
- AI-generated daily plan summary
- Pending tasks sorted by priority
- Generate Plan button (AI-powered)
- Checkbox to complete tasks inline

### Tasks (/(tabs)/tasks)
- Grouped: To Do, In Progress, Done (collapsible)
- Priority indicators (red=high, amber=medium, grey=low)
- FAB to add tasks manually
- Long-press to delete, checkbox to toggle status

### Projects (/(tabs)/projects)
- Project cards with colored borders
- Task count, status badge, description preview
- Expandable to show project tasks inline
- Status cycling (active→paused→completed)

### Memory (/(tabs)/memory)
- Full-screen memory management (moved from modal)
- Grouped by category (preference, goal, project, constraint)
- Category-colored badges, confidence chips
- Delete individual or "Forget everything"

### Chat Enhancements (/(tabs)/aura)
- Rotating placeholder text ("Plan my day...", "Turn this into tasks...", etc.)
- Quick-action chips: Plan, Summarize, Brainstorm, Decide
- Action item cards inline in chat
- Memory button navigates to Memory tab
- Concentric ring orb logo in header (matches welcome screen aesthetic)
- Private mode sends zero history (clean slate per question)
- Normal mode limited to last 20 messages of history

### Premium UI (Stage 3)
- **Projects**: Glass-morphism cards with gradient borders, inline task adding, color picker (5 colors: blue, cyan, purple, teal, amber), progress bars, status badges with icons
- **Tasks**: Elegant section headers with icons/counts, premium task cards with left accent priority bars, animated FAB, per-section empty states
- **Today**: Contextual greeting (Good morning/afternoon/evening), explanatory Generate Plan card, styled numbered step cards for plan, polished task cards
- **Logo**: Stylized "A" character (accent blue) in circular container throughout (header, sidebar, message avatars)
- **Colors**: Unified palette — priority: red/amber/grey; confidence: green/amber/red; categories: monochrome
- **Confidence Popup**: Tappable confidence badge opens centered modal with explanation + AI's reasoning
- **Calm Triage**: Stress keyword detection → AI auto-simplifies to top 3 priorities + next step
- **Wrap-Up Cards**: After 8+ message exchanges with closing signal, offers Summary / Save Tasks / Save to Project
- **Delete on Web**: Platform-aware delete confirmations (window.confirm on web, Alert.alert on native)

## SSE Event Types (streaming chat)
- `content` — text chunks
- `confidence` — `{ confidence, confidenceReason }` — Confidence level with reasoning
- `citations` — research sources
- `document_request` — PDF/DOCX export request
- `action_items` — detected tasks/projects/decisions
- `attachment_context` — file upload processing info
- `mode` — auto-detected mode

## Message Type

```typescript
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "brief" | "memory-prompt";
  mode?: ChatMode;
  confidence?: Confidence;
  citations?: Citation[];
  isPrivate?: boolean;
  timestamp: number;
  briefData?: BriefData;
  replyTo?: { id: string; content: string; role: "user" | "assistant" };
  documentRequest?: DocumentRequest;
  attachments?: { name: string; type: string }[];
  actionItems?: ActionItem[];
};
```

## Tests

- `tests/hallucination.test.ts` — confidence parsing, system prompts, mode templates, answer shapes, document request parsing, refusal policy, attachment understanding, action item parsing
- `tests/memory-privacy.test.ts` — encryption correctness, privacy invariants, API route coverage

Run: `npx tsx tests/hallucination.test.ts` and `npx tsx tests/memory-privacy.test.ts`

## Responsive Web Layout

The app is fully responsive — on desktop/wide screens (>=768px), a left sidebar replaces bottom tabs:

- **Sidebar** (`app/(tabs)/_layout.tsx`): 220px wide, dark surface bg, nav items with active state, Aura logo at top, "truth-first / privacy-first" footer
- **WebContainer** (`components/WebContainer.tsx`): Centers content with max-width (800px for lists). Pass-through on mobile. Chat screen (aura.tsx) does NOT use WebContainer — it fills full width.
- **`useIsWideWeb()` hook**: Returns true when `Platform.OS === "web"` AND `width >= 768`. Used by all screens to reduce top padding when sidebar present.
- **Enter-to-send**: On web, pressing Enter (without Shift) sends messages in the chat
- **Dark scrollbars**: Injected via CSS in root layout (thin, dark-themed)
- **Centered modals**: Task/project/mode picker modals center on web with max-width 480px
- **Welcome screen**: Content capped at 500px max-width, button at 320px, larger orb on desktop

## Design System
- **Background**: #08090A | **Surface**: #111318 | **Accent**: #3B82F6
- **Confidence**: High=#22C55E, Medium=#F59E0B, Low=#EF4444
- **Priority**: High=#EF4444, Medium=#F59E0B, Low=#10B981
- **Font**: Inter (400/500/600/700)
- **Icons**: Ionicons only (no emojis)
- **Tab bar**: Dark bg (mobile), sidebar (web desktop), accent blue active, textTertiary inactive

## AI Integration
- Provider-neutral: OpenAI (`OPENAI_API_KEY`, optional `OPENAI_BASE_URL`) and Anthropic (`ANTHROPIC_API_KEY`). Selection happens in `server/providers/provider-registry.ts` — Anthropic is preferred for skill/frontier tiers when its key is present; OpenAI handles standard, mini, and embedding tiers.
- Chat: gpt-5.2 | Research: gpt-4o-mini with web_search_preview tool
- Daily plan generation: gpt-5.2

## Workflows
- **Start Backend**: `npm run server:dev`
- **Start Frontend**: `npm run expo:dev`
