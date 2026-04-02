import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";
import multer from "multer";
import {
  buildTruthSystemPrompt,
  parseConfidence,
  parseDocumentRequest,
  parseCraftRequest,
  parseActionItems,
  detectMode,
  detectStressSignals,
  type ChatMode,
  type ExplainLevel,
  type SkillContext,
} from "./truth-engine";
import {
  getSkill,
  getChainedSkills,
  getSkillsByDomain,
  SKILL_REGISTRY,
  type SkillDefinition,
  type SkillDomain,
} from "./skill-engine";
import {
  routeSkills,
  composeChainedPrompt,
  type RouteResult,
} from "./skill-router";
import { generatePDF, type DocumentRequest } from "./document-engine";
import { generateCraft, listCrafts, getCraftFilePath, getMimeType } from "./craft-engine";
import type { CraftKind, CraftRequest } from "../shared/schema";
import { runResearch } from "./research-engine";
import {
  processAttachment,
  buildAttachmentContext,
  type ProcessedAttachment,
} from "./file-engine";
import {
  getOrCreateUser,
  getOrCreateConversation,
  getMemories,
  addMemory,
  deleteMemory,
  deleteAllMemories,
  extractAndSaveMemories,
  saveMessage,
  getConversationHistory,
  saveCitations,
} from "./memory-engine";
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  createProject,
  getProjects,
  updateProject,
  deleteProject,
  getDailyPlan,
  generateDailyPlan,
  extractActionItems,
} from "./productivity-engine";
import {
  requireAuth,
  chatRateLimit,
  researchRateLimit,
  memoryRateLimit,
  budgetCheck,
} from "./middleware";
import { selectModel, trackCompletion, getBackgroundModel, type ModelTier } from "./model-router";
import { createStream, getOpenAI } from "./ai-provider";
import { validateConfidenceInResponse } from "./confidence-calibrator";

// ── Performance Logger ──────────────────────────────────────────────────────

const COST_PER_1M_INPUT: Record<string, number> = {
  "gpt-4o-mini": 0.15,
  "gpt-4o": 1.0,
  "claude-sonnet-4-20250514": 3.0,
};

function perfLog(data: Record<string, unknown>) {
  console.log(`[perf] ${JSON.stringify(data)}`);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const openai = getOpenAI();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

// ── Skill Discovery (cached, never changes at runtime) ────────────────────

const SKILL_ICONS: Record<SkillDomain, string> = {
  engineering: "code",
  marketing: "megaphone",
  product: "package",
  finance: "bar-chart",
  leadership: "compass",
  operations: "settings",
};

const SKILL_DESCRIPTIONS: Record<string, string> = {
  "engineering-architect": "System design, scalability, and infrastructure architecture",
  "engineering-code-reviewer": "Code quality, refactoring, and pull request reviews",
  "security-auditor": "Vulnerability assessment, threat modeling, and OWASP compliance",
  "fullstack-engineer": "Modern web development across React, Node, TypeScript, and APIs",
  "gtm-strategist": "Go-to-market positioning, ICP definition, and launch strategy",
  "content-strategist": "Editorial planning, SEO strategy, and content-market fit",
  "growth-marketer": "Funnel optimization, AARRR metrics, and growth experiments",
  "product-manager": "PRDs, RICE prioritization, and product requirements",
  "ux-researcher": "User research methods, usability testing, and design insights",
  "roadmap-planner": "Quarterly planning, OKR alignment, and dependency mapping",
  "financial-analyst": "Unit economics, P&L analysis, and financial health metrics",
  "saas-metrics-coach": "MRR, NRR, churn analysis, and SaaS benchmarking",
  "startup-ceo": "Company strategy, fundraising, and leadership decisions",
  "cto-advisor": "Tech strategy, engineering org design, and build-vs-buy decisions",
  "okr-coach": "Objective and key result setting, alignment, and goal quality",
  "senior-pm": "Project delivery, critical path analysis, and stakeholder management",
  "scrum-master": "Scrum ceremonies, team health, and continuous improvement",
  "technical-writer": "Documentation strategy, Diataxis framework, and content structure",
};

function buildSkillSummary(skill: SkillDefinition) {
  return {
    id: skill.id,
    name: skill.name,
    domain: skill.domain,
    icon: SKILL_ICONS[skill.domain],
    description: SKILL_DESCRIPTIONS[skill.id] || skill.name,
    chainsWith: skill.chainsWith,
    triggerKeywords: skill.triggerKeywords,
  };
}

/** Cached grouped skills response — built once, returned on every GET /api/skills */
let cachedSkillsResponse: Record<string, ReturnType<typeof buildSkillSummary>[]> | null = null;

function getGroupedSkills() {
  if (cachedSkillsResponse) return cachedSkillsResponse;
  const domains: SkillDomain[] = ["engineering", "marketing", "product", "finance", "leadership", "operations"];
  cachedSkillsResponse = {} as Record<string, ReturnType<typeof buildSkillSummary>[]>;
  for (const domain of domains) {
    cachedSkillsResponse[domain] = getSkillsByDomain(domain).map(buildSkillSummary);
  }
  return cachedSkillsResponse;
}

function getAllSkillIds(): string[] {
  return Array.from(SKILL_REGISTRY.keys());
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ─── HEALTH ────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, version: "2.1.0" });
  });

  // ─── CHAT (streaming, truth-first, with model routing) ────────────────
  app.post("/api/chat", chatRateLimit, budgetCheck, upload.array("attachments", 5), async (req, res) => {
    try {
      let body = req.body;
      if (typeof body.messages === "string") {
        body = {
          ...body,
          messages: JSON.parse(body.messages || "[]"),
          memory: body.memory ? JSON.parse(body.memory) : [],
          isPrivate: body.isPrivate === "true",
          rememberFlag: body.rememberFlag !== "false",
          autoDetectMode: body.autoDetectMode === "true",
        };
      }

      const {
        messages = [],
        memory: clientMemory = [],
        mode: requestedMode,
        explainLevel = "normal",
        isPrivate = false,
        rememberFlag = true,
        autoDetectMode = false,
        activeSkillId,
      } = body;

      const userId = req.userId;
      const files = (req.files as Express.Multer.File[]) || [];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      let processedAttachments: ProcessedAttachment[] = [];
      if (files.length > 0) {
        processedAttachments = await Promise.all(
          files.map((f) => processAttachment(f.buffer, f.mimetype, f.originalname))
        );
        const attachmentSummary = processedAttachments.map((a) => {
          if (a.type === "image") return { type: "image", filename: a.filename };
          return { type: "document", filename: a.filename, pageCount: a.pageCount, truncated: a.truncated };
        });
        res.write(`data: ${JSON.stringify({ type: "attachment_context", attachments: attachmentSummary })}\n\n`);
      }

      const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
      const requestStart = Date.now();

      // ─── Memory + conversation setup ───────────────────────────────
      const memoryStart = Date.now();
      let conversationId: string | null = null;
      let dbMemory: { text: string; category: string }[] = clientMemory;

      if (userId) {
        conversationId = await getOrCreateConversation(userId);
        const memories = await getMemories(userId);
        dbMemory = memories.map((m: any) => ({ text: m.text, category: m.category }));
      }
      perfLog({ step: "memory-retrieval", ms: Date.now() - memoryStart });

      // ─── Parallel detection: mode + domain (runs simultaneously) ───
      const detectionStart = Date.now();

      const activeProjectContext = dbMemory
        .filter((m) => m.category === "project")
        .map((m) => m.text)
        .join("; ")
        .slice(0, 100);

      const needsModeDetect = autoDetectMode && !requestedMode;

      const [detectedMode, skillRoute] = await Promise.all([
        needsModeDetect
          ? detectMode(lastUserMessage, openai)
          : Promise.resolve(requestedMode || "chat" as ChatMode),
        routeSkills(lastUserMessage, activeProjectContext, dbMemory, openai).catch((err): RouteResult => {
          console.warn("[skill-router] routeSkills failed, continuing without skill:", err);
          return { primary: "engineering", secondary: null, layer: "heuristic" };
        }),
      ]);

      let mode: ChatMode = detectedMode;
      const detectionMs = Date.now() - detectionStart;
      perfLog({ step: "parallel-detection", ms: detectionMs, mode, domain: skillRoute.primary, layer: skillRoute.layer });

      if (needsModeDetect) {
        res.write(`data: ${JSON.stringify({ type: "mode", mode })}\n\n`);
      }

      // ─── Skill resolution (client override > auto-detection) ───────
      let activeSkill: SkillDefinition | undefined;
      let skillContext: SkillContext | undefined;
      let wasAutoDetected = false;
      let chainedPromptOverride: string | undefined;
      let detectedSkill: {
        primary: SkillDomain | null;
        secondary: SkillDomain | null;
        wasAutoDetected: boolean;
        skillName: string | null;
      } | null = null;
      let routingFailed = false;

      if (activeSkillId) {
        // Client explicitly selected a skill — validate it
        activeSkill = getSkill(activeSkillId);
        if (!activeSkill) {
          res.write(`data: ${JSON.stringify({ type: "error", error: "Unknown skill ID", validSkills: getAllSkillIds() })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        skillContext = { userMessage: lastUserMessage, chainedSkillIds: activeSkill.chainsWith };
        detectedSkill = {
          primary: activeSkill.domain,
          secondary: null,
          wasAutoDetected: false,
          skillName: activeSkill.name,
        };

        console.log(`[routing] Client-specified skill: ${activeSkill.id} (${detectionMs}ms)`);

      } else if (skillRoute.secondary) {
        // Multi-domain detected — compose chained prompt
        const primarySkills = getSkillsByDomain(skillRoute.primary);
        const secondarySkills = getSkillsByDomain(skillRoute.secondary);
        if (primarySkills.length > 0 && secondarySkills.length > 0) {
          activeSkill = primarySkills[0];
          const secondarySkill = secondarySkills[0];
          skillContext = { userMessage: lastUserMessage, chainedSkillIds: activeSkill.chainsWith };
          chainedPromptOverride = composeChainedPrompt(activeSkill, secondarySkill, skillContext);
          wasAutoDetected = true;
          detectedSkill = {
            primary: skillRoute.primary,
            secondary: skillRoute.secondary,
            wasAutoDetected: true,
            skillName: `${activeSkill.name} + ${secondarySkill.name}`,
          };

          console.log(
            `[routing] Chained: ${activeSkill.id} + ${secondarySkill.id} ` +
            `(layer: ${skillRoute.layer}, ${detectionMs}ms)`
          );
        }

      } else if (skillRoute.primary) {
        // Single domain auto-detected
        const domainSkills = getSkillsByDomain(skillRoute.primary);
        if (domainSkills.length > 0) {
          activeSkill = domainSkills[0];
          skillContext = { userMessage: lastUserMessage, chainedSkillIds: activeSkill.chainsWith };
          wasAutoDetected = true;
          detectedSkill = {
            primary: skillRoute.primary,
            secondary: null,
            wasAutoDetected: true,
            skillName: activeSkill.name,
          };

          console.log(
            `[routing] Auto-detected: ${activeSkill.id} ` +
            `(layer: ${skillRoute.layer}, ${detectionMs}ms)`
          );
        }
      }

      // Emit skill detection info to client
      if (detectedSkill) {
        res.write(`data: ${JSON.stringify({ type: "skill_active", ...detectedSkill })}\n\n`);
      }

      const isTriage = detectStressSignals(lastUserMessage);
      const promptStart = Date.now();
      const systemPrompt = chainedPromptOverride
        ? buildTruthSystemPrompt(mode, explainLevel, dbMemory, { isTriage }) +
          "\n\n---\nACTIVE DOMAIN EXPERTISE:\n" + chainedPromptOverride
        : buildTruthSystemPrompt(mode, explainLevel, dbMemory, {
            isTriage,
            activeSkill,
            skillContext,
          });
      perfLog({ step: "prompt-build", ms: Date.now() - promptStart, skill: activeSkill?.id || null });

      // ─── Token & cost audit ────────────────────────────────────────
      const promptTokens = estimateTokens(systemPrompt);
      perfLog({ event: "prompt-tokens", estimated: promptTokens, skill: activeSkill?.id || null });
      if (promptTokens > 3000) {
        console.warn(`[token-audit] System prompt exceeds 3000 tokens: ~${promptTokens} (skill: ${activeSkill?.id || "none"})`);
      }

      // ─── Research mode ─────────────────────────────────────────────
      if (mode === "research") {
        const result = await runResearch(lastUserMessage, openai, dbMemory);

        if (result.citations.length > 0) {
          res.write(`data: ${JSON.stringify({ type: "citations", citations: result.citations })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ type: "confidence", confidence: result.confidence })}\n\n`);

        const words = result.content.split(" ");
        for (const word of words) {
          res.write(`data: ${JSON.stringify({ content: word + " " })}\n\n`);
          await new Promise((r) => setTimeout(r, 12));
        }

        if (!isPrivate && userId && conversationId) {
          await saveMessage(conversationId, "user", lastUserMessage, { mode, explainLevel, rememberFlag, isPrivate });
          const asstMsgId = await saveMessage(conversationId, "assistant", result.content, {
            mode, confidence: result.confidence, explainLevel, isPrivate: false,
          });
          if (result.citations.length > 0) await saveCitations(asstMsgId, result.citations);
          if (rememberFlag) extractAndSaveMemories(userId, lastUserMessage, openai).catch(console.error);
        }

        if (userId) trackCompletion(userId, lastUserMessage, result.content);

        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      // ─── Standard chat mode with model routing ─────────────────────
      const modelConfig = selectModel(mode, lastUserMessage, {
        activeSkillDomain: activeSkill?.domain,
        isChained: !!chainedPromptOverride,
        isTriage,
      });
      res.write(`data: ${JSON.stringify({ type: "model_tier", tier: modelConfig.tier, reason: modelConfig.reason })}\n\n`);

      const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
      ];

      for (const msg of messages) {
        if (msg.role === "user" && msg === messages[messages.length - 1] && processedAttachments.length > 0) {
          const attachContext = buildAttachmentContext(processedAttachments);
          const combined = (attachContext ? attachContext + "\n\n" : "") + msg.content;
          chatMessages.push({ role: "user", content: combined });
        } else {
          chatMessages.push({ role: msg.role, content: msg.content });
        }
      }

      // Stream via unified provider — Claude for skills, OpenAI for everything else
      const stream = createStream(modelConfig.modelId, chatMessages, modelConfig.maxTokens);

      let fullContent = "";
      let actionMarkerDetected = false;
      for await (const chunk of stream) {
        const content = chunk.content;
        if (content) {
          fullContent += content;
          if (fullContent.includes("|||ACTION_ITEMS|||") || fullContent.includes("|||CRAFT_REQUEST|||")) actionMarkerDetected = true;
          if (!actionMarkerDetected) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
      }

      const { cleanContent: preActionContent, actionItems } = parseActionItems(fullContent);
      const { cleanContent: preConfContent, confidence, confidenceReason } = parseConfidence(preActionContent);
      const { cleanContent: preCraftContent, craftRequest } = parseCraftRequest(preConfContent);
      const { cleanContent, documentRequest } = parseDocumentRequest(preCraftContent);

      res.write(`data: ${JSON.stringify({
        type: "confidence",
        confidence,
        confidenceReason,
        ...(activeSkillId ? { activeSkillId } : {}),
        ...(detectedSkill ? { detectedSkill } : {}),
      })}\n\n`);
      if (documentRequest) res.write(`data: ${JSON.stringify({ type: "document_request", documentRequest })}\n\n`);
      if (craftRequest) res.write(`data: ${JSON.stringify({ type: "craft_request", craftRequest })}\n\n`);
      if (actionItems.length > 0) res.write(`data: ${JSON.stringify({ type: "action_items", actionItems })}\n\n`);

      if (!isPrivate && userId && conversationId) {
        await saveMessage(conversationId, "user", lastUserMessage, { mode, explainLevel, rememberFlag, isPrivate });
        await saveMessage(conversationId, "assistant", cleanContent, { mode, confidence, explainLevel });
        if (rememberFlag) extractAndSaveMemories(userId, lastUserMessage, openai).catch(console.error);
        await conversationHeartbeat(conversationId);
      }

      if (userId) trackCompletion(userId, lastUserMessage, fullContent, modelConfig.tier);

      // ─── Confidence monitoring ─────────────────────────────────────
      if (activeSkill && confidence) {
        const validation = validateConfidenceInResponse(fullContent, activeSkill.domain);
        if (!validation.isAppropriate) {
          perfLog({ event: "confidence-overclaim", skill: activeSkill.id, claimed: validation.claimed, warning: validation.warning });
        }
      }

      // ─── Cost estimate ─────────────────────────────────────────────
      const totalInputTokens = promptTokens + estimateTokens(lastUserMessage);
      const outputTokens = estimateTokens(fullContent);
      const costRate = COST_PER_1M_INPUT[modelConfig.model] || 0.15;
      const estimatedCostUSD = ((totalInputTokens + outputTokens) / 1_000_000) * costRate;
      const totalMs = Date.now() - requestStart;

      perfLog({
        step: "request-complete",
        totalMs,
        model: modelConfig.model,
        tier: modelConfig.tier,
        reason: modelConfig.reason,
        skill: activeSkill?.id || null,
        estimatedInputTokens: totalInputTokens,
        estimatedOutputTokens: outputTokens,
        estimatedCostUSD: +estimatedCostUSD.toFixed(6),
      });

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      console.error("Chat error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed" });
      else { res.write("data: [DONE]\n\n"); res.end(); }
    }
  });

  // ─── RESEARCH (non-streaming) ──────────────────────────────────────────
  app.post("/api/research", researchRateLimit, budgetCheck, async (req, res) => {
    try {
      const { query: searchQuery, memory: clientMemory = [] } = req.body;
      const userId = req.userId;

      let dbMemory = clientMemory;
      if (userId) {
        const memories = await getMemories(userId);
        dbMemory = memories.map((m) => ({ text: m.text, category: m.category }));
      }

      const result = await runResearch(searchQuery, openai, dbMemory);
      if (userId) trackCompletion(userId, searchQuery, result.content);
      res.json(result);
    } catch (err) {
      console.error("Research error:", err);
      res.status(500).json({ error: "Research failed" });
    }
  });

  // ─── DOCUMENT EXPORT ──────────────────────────────────────────────────
  app.post("/api/export", async (req, res) => {
    try {
      const docRequest: DocumentRequest = req.body;
      if (!docRequest.title || !docRequest.sections?.length) {
        return res.status(400).json({ error: "title and sections are required" });
      }
      if (docRequest.sections.length > 20) {
        return res.status(400).json({ error: "Too many sections (max 20)" });
      }
      const totalLength = docRequest.sections.reduce((sum, s) => sum + (s.content_markdown?.length || 0), 0);
      if (totalLength > 50000) {
        return res.status(400).json({ error: "Content too large (max 50k chars)" });
      }

      const pdfBuffer = await generatePDF(docRequest);
      const filename = docRequest.filename || `${docRequest.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length.toString());
      res.send(pdfBuffer);
    } catch (err) {
      console.error("Export error:", err);
      res.status(500).json({ error: "Failed to generate document" });
    }
  });

  // ─── CRAFTS ───────────────────────────────────────────────────────────
  app.post("/api/crafts/generate", requireAuth, budgetCheck, async (req, res) => {
    try {
      const request: CraftRequest = req.body;

      if (!request.kind || !request.title) {
        return res.status(400).json({ error: "kind and title are required" });
      }

      const validKinds: CraftKind[] = ["pdf", "docx", "pptx", "xlsx", "html", "react", "svg", "markdown", "code"];
      if (!validKinds.includes(request.kind)) {
        return res.status(400).json({ error: `Invalid kind. Valid: ${validKinds.join(", ")}` });
      }

      // Validate per-kind constraints
      if (["pdf", "docx"].includes(request.kind)) {
        if (!request.sections?.length) return res.status(400).json({ error: "sections required for document crafts" });
        if (request.sections.length > 20) return res.status(400).json({ error: "Too many sections (max 20)" });
        const totalLen = request.sections.reduce((s, sec) => s + (sec.content_markdown?.length || 0), 0);
        if (totalLen > 50000) return res.status(400).json({ error: "Content too large (max 50k chars)" });
      }
      if (request.kind === "pptx" && request.slides && request.slides.length > 30) {
        return res.status(400).json({ error: "Too many slides (max 30)" });
      }
      if (request.kind === "xlsx" && request.sheets && request.sheets.length > 10) {
        return res.status(400).json({ error: "Too many sheets (max 10)" });
      }
      if (["html", "react", "svg", "markdown", "code"].includes(request.kind)) {
        if (!request.content) return res.status(400).json({ error: "content required for inline crafts" });
        if (request.content.length > 100000) return res.status(400).json({ error: "Content too large (max 100k chars)" });
      }

      const result = await generateCraft(req.userId!, request);
      res.json(result);
    } catch (err) {
      console.error("Craft generation error:", err);
      res.status(500).json({ error: "Aura couldn't craft that right now. Please try again." });
    }
  });

  app.get("/api/crafts", requireAuth, async (req, res) => {
    try {
      const crafts = await listCrafts(req.userId!);
      res.json(crafts);
    } catch (err) {
      console.error("List crafts error:", err);
      res.status(500).json({ error: "Failed to fetch crafts" });
    }
  });

  app.get("/api/crafts/:id/download", requireAuth, async (req, res) => {
    try {
      const result = await getCraftFilePath(req.userId!, req.params.id);
      if (!result) return res.status(404).json({ error: "Craft not found" });

      const { filePath, filename, kind } = result;
      const fs = await import("fs");
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Craft file not found" });

      const buffer = fs.readFileSync(filePath);
      res.setHeader("Content-Type", getMimeType(kind));
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length.toString());
      res.send(buffer);
    } catch (err) {
      console.error("Craft download error:", err);
      res.status(500).json({ error: "Failed to download craft" });
    }
  });

  // ─── MESSAGES ─────────────────────────────────────────────────────────
  app.get("/api/messages", async (req, res) => {
    try {
      if (!req.userId) return res.json([]);
      const conversationId = await getOrCreateConversation(req.userId);
      const history = await getConversationHistory(conversationId, 50);
      res.json(history);
    } catch (err) {
      console.error("Get messages error:", err);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // ─── MEMORIES ─────────────────────────────────────────────────────────
  app.get("/api/memories", async (req, res) => {
    try {
      if (!req.userId) return res.json([]);
      const memories = await getMemories(req.userId);
      res.json(memories);
    } catch (err) {
      console.error("Get memories error:", err);
      res.status(500).json({ error: "Failed to fetch memories" });
    }
  });

  app.post("/api/memories", requireAuth, memoryRateLimit, async (req, res) => {
    try {
      const { text, category = "context", confidence = "High" } = req.body;
      if (!text) return res.status(400).json({ error: "text is required" });

      const memory = await addMemory(req.userId!, text, category, confidence);
      res.json(memory);
    } catch (err) {
      console.error("Add memory error:", err);
      res.status(500).json({ error: "Failed to add memory" });
    }
  });

  app.delete("/api/memories/:id", requireAuth, async (req, res) => {
    try {
      await deleteMemory(req.userId!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete memory error:", err);
      res.status(500).json({ error: "Failed to delete memory" });
    }
  });

  app.delete("/api/memories", requireAuth, async (req, res) => {
    try {
      await deleteAllMemories(req.userId!);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete all memories error:", err);
      res.status(500).json({ error: "Failed to clear memories" });
    }
  });

  // ─── EXTRACT MEMORY ───────────────────────────────────────────────────
  app.post("/api/extract-memory", memoryRateLimit, async (req, res) => {
    try {
      const { message, save = false } = req.body;

      const response = await openai.chat.completions.create({
        model: getBackgroundModel(),
        messages: [
          {
            role: "user",
            content: `Extract memory-worthy facts from this message. Only extract stable, safe facts (goals, habits, preferences, projects).

Message: "${message}"

Return ONLY valid JSON: {"shouldRemember": boolean, "items": [{"text": "concise fact", "category": "goal|habit|preference|project|context", "confidence": "High|Medium|Low"}]}

If nothing worth remembering: {"shouldRemember": false, "items": []}`,
          },
        ],
        max_completion_tokens: 300,
      });

      const raw = response.choices[0]?.message?.content?.trim() || "{}";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const data = JSON.parse(cleaned);

      if (save && data.shouldRemember && data.items?.length && req.userId) {
        for (const item of data.items) {
          await addMemory(req.userId, item.text, item.category, item.confidence || "High");
        }
      }

      res.json(data);
    } catch (err) {
      res.json({ shouldRemember: false, items: [] });
    }
  });

  // ─── DAILY BRIEF ──────────────────────────────────────────────────────
  app.post("/api/brief", async (req, res) => {
    try {
      const { memory: clientMemory = [], recentMessages = [] } = req.body;
      const userId = req.userId;
      const hour = new Date().getHours();
      const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

      let dbMemory = clientMemory;
      if (userId) {
        const memories = await getMemories(userId);
        if (memories.length > 0) {
          dbMemory = memories.map((m) => ({ text: m.text, category: m.category }));
        }
      }

      const memoryContext = dbMemory.length > 0
        ? `Memory: ${dbMemory.map((m: any) => m.text).join("; ")}`
        : "";
      const chatContext = recentMessages.length > 0
        ? `Recent conversation themes: ${recentMessages.slice(-6).map((m: any) => m.content).join(" | ")}`
        : "";

      const response = await openai.chat.completions.create({
        model: getBackgroundModel(),
        messages: [
          {
            role: "user",
            content: `Generate a ${period} brief for this person. ${memoryContext} ${chatContext}

Return ONLY valid JSON (no markdown): {"reflection":"one sentence that mirrors something real about them","pattern":"one observation about their week or habits","action":"one concrete small action for today"}

Keep each field under 15 words. Be specific and personal. Never invent facts you don't have.`,
          },
        ],
        max_completion_tokens: 256,
      });

      const raw = response.choices[0]?.message?.content?.trim() || "{}";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      res.json({ ...JSON.parse(cleaned), period });
    } catch (err) {
      console.error("Brief error:", err);
      res.status(500).json({
        reflection: "Every day is data. You're building something.",
        pattern: "You keep showing up. That's the habit.",
        action: "One honest conversation today.",
        period: "day",
      });
    }
  });

  // ─── TASKS ────────────────────────────────────────────────────────────
  app.get("/api/tasks", async (req, res) => {
    try {
      if (!req.userId) return res.json([]);
      const status = req.query.status as string | undefined;
      const projectId = req.query.project_id as string | undefined;
      const tasks = await getTasks(req.userId, { status, projectId });
      res.json(tasks);
    } catch (err) {
      console.error("Get tasks error:", err);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const { title, description, priority, dueDate, projectId } = req.body;
      if (!title) return res.status(400).json({ error: "title is required" });
      const task = await createTask(req.userId!, title, description, priority, dueDate, projectId);
      res.json(task);
    } catch (err) {
      console.error("Create task error:", err);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await updateTask(req.userId!, req.params.id, req.body);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (err) {
      console.error("Update task error:", err);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      await deleteTask(req.userId!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete task error:", err);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // ─── PROJECTS ─────────────────────────────────────────────────────────
  app.get("/api/projects", async (req, res) => {
    try {
      if (!req.userId) return res.json([]);
      const projects = await getProjects(req.userId);
      res.json(projects);
    } catch (err) {
      console.error("Get projects error:", err);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const project = await createProject(req.userId!, name, description);
      res.json(project);
    } catch (err) {
      console.error("Create project error:", err);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const project = await updateProject(req.userId!, req.params.id, req.body);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json(project);
    } catch (err) {
      console.error("Update project error:", err);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      await deleteProject(req.userId!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete project error:", err);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // ─── TODAY / DAILY PLAN ───────────────────────────────────────────────
  app.get("/api/today", async (req, res) => {
    try {
      if (!req.userId) return res.json({ plan: null, tasks: [] });
      const plan = await getDailyPlan(req.userId);
      const tasks = await getTasks(req.userId);
      const pendingTasks = tasks.filter((t) => t.status !== "done");
      res.json({ plan, tasks: pendingTasks });
    } catch (err) {
      console.error("Get today error:", err);
      res.status(500).json({ error: "Failed to fetch today's plan" });
    }
  });

  app.post("/api/today/generate", requireAuth, async (req, res) => {
    try {
      const plan = await generateDailyPlan(req.userId!, openai);
      const tasks = await getTasks(req.userId!);
      const pendingTasks = tasks.filter((t) => t.status !== "done");
      res.json({ plan, tasks: pendingTasks });
    } catch (err) {
      console.error("Generate plan error:", err);
      res.status(500).json({ error: "Failed to generate daily plan" });
    }
  });

  // ─── EXTRACT ACTION ITEMS ─────────────────────────────────────────────
  app.post("/api/extract-actions", async (req, res) => {
    try {
      const { message, assistantResponse } = req.body;
      if (!message || !assistantResponse) {
        return res.status(400).json({ error: "message and assistantResponse are required" });
      }
      const items = await extractActionItems(message, assistantResponse, openai);
      res.json(items);
    } catch (err) {
      console.error("Extract actions error:", err);
      res.status(500).json({ error: "Failed to extract action items" });
    }
  });

  // ─── SKILLS ───────────────────────────────────────────────────────────
  app.get("/api/skills", requireAuth, (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(getGroupedSkills());
  });

  app.get("/api/skills/:id", requireAuth, (req, res) => {
    const skill = getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(buildSkillSummary(skill));
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function conversationHeartbeat(conversationId: string) {
  try {
    const { query } = await import("./db");
    await query("UPDATE conversations SET updated_at = NOW() WHERE id = $1", [conversationId]);
  } catch {}
}
