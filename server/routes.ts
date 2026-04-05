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
import { generateCraft, listCrafts, getCraft, getCraftFilePath, getMimeType, deleteCraft } from "./craft-engine";
import { getTemplates } from "./craft-templates";
import type { CraftKind, CraftRequest } from "../shared/schema";
import { runResearch } from "./research-engine";
import { shouldCheckConsolidation, runConsolidation, getConsolidationStatus } from "./memory-consolidator";
import { generateSuggestions } from "./suggestions-engine";
import { hybridSearch, type RetrievalResult } from "./retrieval-engine";
import { chainOfVerification, selfConsistencyCheck, computeCompositeConfidence, applyDomainCalibration } from "./verification-engine";
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
  legal: "shield-checkmark",
  education: "school",
  health: "heart",
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
  "legal-contract-reviewer": "Contract risk analysis, clause explanation, and amendment suggestions",
  "legal-compliance-advisor": "GDPR, CCPA, HIPAA compliance checklists and gap analysis",
  "curriculum-designer": "Course design with backward design, Bloom's taxonomy, and assessment alignment",
  "tutoring-expert": "Socratic teaching, scaffolded learning, and concept explanation",
  "wellness-coach": "Evidence-based wellness, habit formation, and fitness principles",
  "data-engineer": "Data pipelines, ETL/ELT, warehousing, and data modeling",
  "brand-strategist": "Brand identity, voice and tone, positioning, and brand architecture",
  "investor-relations": "Pitch decks, cap tables, term sheets, and investor updates",
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

      // Status: thinking
      res.write(`data: ${JSON.stringify({ type: "status", step: "thinking", message: "Understanding your question..." })}\n\n`);

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
        res.write(`data: ${JSON.stringify({ type: "status", step: "searching", message: "Searching the web..." })}\n\n`);
        const result = await runResearch(lastUserMessage, openai, dbMemory);

        if (result.citations.length > 0) {
          const sourceDomains = result.citations.map((c) => { try { return new URL(c.url).hostname; } catch { return c.url; } });
          res.write(`data: ${JSON.stringify({ type: "status", step: "reading", message: `Reading ${result.citations.length} sources...`, sources: sourceDomains })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: "citations", citations: result.citations })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ type: "status", step: "composing", message: "Putting it all together..." })}\n\n`);
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

      // Status: composing
      res.write(`data: ${JSON.stringify({ type: "status", step: "composing", message: "Putting it all together..." })}\n\n`);

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

      // ─── Verification pipeline (research + decision modes) ────────
      let verificationSources: RetrievalResult[] = [];
      let compositeScore: number | undefined;
      let compositeLevel: string | undefined;

      if (mode === "decision") {
        try {
          verificationSources = await hybridSearch(lastUserMessage, 5);
          if (verificationSources.length > 0) {
            res.write(`data: ${JSON.stringify({
              type: "sources",
              sources: verificationSources.map((s) => ({
                title: s.sourceTitle, url: s.sourceUrl, quality: s.qualityScore, sourceType: s.sourceType,
              })),
            })}\n\n`);
          }

          const verification = await chainOfVerification(lastUserMessage, cleanContent, verificationSources, openai);

          if (verification.verifiedClaims.length > 0) {
            res.write(`data: ${JSON.stringify({
              type: "claims",
              claims: verification.verifiedClaims.map((c) => ({
                claim: c.claim, confidence: c.confidence, sources: c.sources,
              })),
            })}\n\n`);
          }

          // Apply domain calibration as final authority
          const finalLevel = activeSkill
            ? applyDomainCalibration(verification.overallConfidence, confidence as "High" | "Medium" | "Low")
            : verification.overallConfidence;

          compositeScore = verification.compositeScore;
          compositeLevel = finalLevel;

          res.write(`data: ${JSON.stringify({
            type: "composite_confidence",
            score: verification.compositeScore,
            level: finalLevel,
            breakdown: {
              claims: verification.verifiedClaims.length,
              disclaimers: verification.disclaimers,
            },
          })}\n\n`);

          if (verification.disclaimers.length > 0) {
            perfLog({ event: "verification-disclaimers", disclaimers: verification.disclaimers });
          }
        } catch (verifyErr) {
          console.warn("[verification] Pipeline failed, using LLM confidence:", verifyErr);
        }
      }

      res.write(`data: ${JSON.stringify({
        type: "confidence",
        confidence: compositeLevel || confidence,
        confidenceReason,
        ...(compositeScore !== undefined ? { compositeScore } : {}),
        ...(activeSkillId ? { activeSkillId } : {}),
        ...(detectedSkill ? { detectedSkill } : {}),
      })}\n\n`);
      if (documentRequest) res.write(`data: ${JSON.stringify({ type: "document_request", documentRequest })}\n\n`);
      if (craftRequest && userId) {
        try {
          const craftResult = await generateCraft(userId, { ...craftRequest, conversationId: conversationId || undefined });
          res.write(`data: ${JSON.stringify({ type: "craft", craft: craftResult.craft, downloadUrl: craftResult.downloadUrl, content: craftResult.content })}\n\n`);
        } catch (craftErr) {
          console.error("Auto-craft generation failed:", craftErr);
          res.write(`data: ${JSON.stringify({ type: "craft_request", craftRequest })}\n\n`);
        }
      } else if (craftRequest) {
        res.write(`data: ${JSON.stringify({ type: "craft_request", craftRequest })}\n\n`);
      }
      if (actionItems.length > 0) res.write(`data: ${JSON.stringify({ type: "action_items", actionItems })}\n\n`);

      if (!isPrivate && userId && conversationId) {
        await saveMessage(conversationId, "user", lastUserMessage, { mode, explainLevel, rememberFlag, isPrivate });
        await saveMessage(conversationId, "assistant", cleanContent, { mode, confidence, explainLevel });
        if (rememberFlag) extractAndSaveMemories(userId, lastUserMessage, openai).catch(console.error);
        await conversationHeartbeat(conversationId);
        // Memory consolidation check (every 10th request, async)
        if (shouldCheckConsolidation(userId)) {
          runConsolidation(userId).catch((err) => console.warn("[consolidator] Async consolidation failed:", err));
        }
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

      // Smart suggestions (async, don't block DONE)
      try {
        const suggestions = await generateSuggestions(lastUserMessage, cleanContent, mode);
        if (suggestions.length > 0) {
          res.write(`data: ${JSON.stringify({ type: "suggestions", suggestions })}\n\n`);
        }
      } catch {}

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

  // ─── KNOWLEDGE INGESTION ───────────────────────────────────────────────
  app.post("/api/knowledge/ingest", requireAuth, budgetCheck, async (req, res) => {
    try {
      const { content, sourceUrl, sourceTitle, sourceType = "user_provided" } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "content is required" });
      }
      if (content.length > 200000) {
        return res.status(400).json({ error: "Content too large (max 200k chars)" });
      }
      const validTypes = ["academic", "government", "news", "documentation", "blog", "user_provided"];
      if (!validTypes.includes(sourceType)) {
        return res.status(400).json({ error: `Invalid sourceType. Valid: ${validTypes.join(", ")}` });
      }

      const { randomUUID } = await import("crypto");
      const { chunkAndEmbed } = await import("./embedding-engine");
      const { scoreSourceQuality } = await import("./retrieval-engine");

      const parentDocumentId = randomUUID();
      const qualityScore = scoreSourceQuality(sourceType, sourceUrl);
      const chunksCreated = await chunkAndEmbed(content, {
        sourceUrl, sourceTitle, sourceType, qualityScore, parentDocumentId,
      });

      res.json({ success: true, parentDocumentId, chunksCreated });
    } catch (err) {
      console.error("Knowledge ingestion error:", err);
      res.status(500).json({ error: "Failed to ingest knowledge" });
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
      const result = await getCraftFilePath(req.userId!, req.params.id as string);
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

  app.get("/api/crafts/:id", requireAuth, async (req, res) => {
    try {
      const craft = await getCraft(req.userId!, req.params.id as string);
      if (!craft) return res.status(404).json({ error: "Craft not found" });
      res.json(craft);
    } catch (err) {
      console.error("Get craft error:", err);
      res.status(500).json({ error: "Failed to fetch craft" });
    }
  });

  app.delete("/api/crafts/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await deleteCraft(req.userId!, req.params.id as string);
      if (!deleted) return res.status(404).json({ error: "Craft not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete craft error:", err);
      res.status(500).json({ error: "Failed to delete craft" });
    }
  });

  app.get("/api/craft-templates", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(getTemplates());
  });

  // ─── BUILDER ──────────────────────────────────────────────────────────
  (() => {
    const builderImports = {
      engine: require("./builder-engine") as typeof import("./builder-engine"),
      prompts: require("./builder-prompts") as typeof import("./builder-prompts"),
    };

    app.post("/api/builder/generate", requireAuth, budgetCheck, async (req, res) => {
      try {
        const { projectId, prompt, type = "website", name } = req.body;
        if (!prompt) return res.status(400).json({ error: "prompt is required" });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.flushHeaders();

        // Create or fetch project
        let project;
        if (projectId) {
          project = await builderImports.engine.getBuilderProject(projectId, req.userId!);
          if (!project) {
            res.write(`data: ${JSON.stringify({ type: "error", error: "Project not found" })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
        } else {
          project = await builderImports.engine.createBuilderProject(
            req.userId!, type, name || "Untitled Website"
          );
        }

        // Build messages
        const systemPrompt = type === "mobile-app"
          ? builderImports.prompts.MOBILE_APP_BUILDER_PROMPT
          : builderImports.prompts.WEBSITE_BUILDER_PROMPT;

        const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
          { role: "system", content: systemPrompt },
        ];

        // Include existing HTML as context for iterations
        if (project.currentHtml) {
          messages.push({
            role: "assistant",
            content: project.currentHtml,
          });
        }

        messages.push({ role: "user", content: prompt });

        // Stream generation
        const { createStream: streamAI } = await import("./ai-provider");
        const stream = streamAI("gpt-4o-mini", messages, 8192);

        let fullHtml = "";
        for await (const chunk of stream) {
          if (chunk.content) {
            fullHtml += chunk.content;
            res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk.content })}\n\n`);
          }
        }

        // Save to project
        const files = { ...project.files, "index.html": fullHtml };
        await builderImports.engine.updateProjectFiles(project.id, files, fullHtml);

        res.write(`data: ${JSON.stringify({
          type: "complete",
          project: { id: project.id, name: project.name, type: project.type },
        })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (err) {
        console.error("Builder generate error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Aura couldn't build that right now" });
        else { res.write("data: [DONE]\n\n"); res.end(); }
      }
    });

    app.get("/api/builder/projects", requireAuth, async (req, res) => {
      try {
        const projects = await builderImports.engine.getUserBuilderProjects(req.userId!);
        res.json(projects);
      } catch (err) {
        console.error("List builder projects error:", err);
        res.status(500).json({ error: "Failed to fetch projects" });
      }
    });

    app.get("/api/builder/projects/:id", requireAuth, async (req, res) => {
      try {
        const project = await builderImports.engine.getBuilderProject(req.params.id as string, req.userId!);
        if (!project) return res.status(404).json({ error: "Project not found" });
        res.json(project);
      } catch (err) {
        console.error("Get builder project error:", err);
        res.status(500).json({ error: "Failed to fetch project" });
      }
    });

    app.delete("/api/builder/projects/:id", requireAuth, async (req, res) => {
      try {
        const deleted = await builderImports.engine.deleteBuilderProject(req.params.id as string, req.userId!);
        if (!deleted) return res.status(404).json({ error: "Project not found" });
        res.json({ success: true });
      } catch (err) {
        console.error("Delete builder project error:", err);
        res.status(500).json({ error: "Failed to delete project" });
      }
    });

    app.post("/api/builder/projects/:id/deploy", requireAuth, async (req, res) => {
      try {
        const { vercelToken } = req.body;
        if (!vercelToken) return res.status(400).json({ error: "vercelToken is required" });

        const project = await builderImports.engine.getBuilderProject(req.params.id as string, req.userId!);
        if (!project) return res.status(404).json({ error: "Project not found" });
        if (!project.files || Object.keys(project.files).length === 0) {
          return res.status(400).json({ error: "No files to deploy" });
        }

        const { deployToVercel, saveDeployUrl } = await import("./deploy-engine");
        const result = await deployToVercel(project.name, project.files, vercelToken);
        await saveDeployUrl(project.id, result.url);

        res.json({ success: true, url: result.url, deploymentId: result.deploymentId });
      } catch (err) {
        console.error("Deploy error:", err);
        res.status(500).json({ error: "Deployment failed — check your Vercel token" });
      }
    });
  })();

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
      await deleteMemory(req.userId!, req.params.id as string);
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
      const task = await updateTask(req.userId!, req.params.id as string, req.body);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (err) {
      console.error("Update task error:", err);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      await deleteTask(req.userId!, req.params.id as string);
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
      const project = await updateProject(req.userId!, req.params.id as string, req.body);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json(project);
    } catch (err) {
      console.error("Update project error:", err);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      await deleteProject(req.userId!, req.params.id as string);
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

  // ─── FEEDBACK ──────────────────────────────────────────────────────────
  app.post("/api/feedback", requireAuth, async (req, res) => {
    try {
      const { messageId, conversationId, rating, comment } = req.body;
      if (!rating || !["up", "down"].includes(rating)) {
        return res.status(400).json({ error: "rating must be 'up' or 'down'" });
      }
      const { query: dbQuery } = await import("./db");
      await dbQuery(
        `INSERT INTO feedback (user_id, message_id, conversation_id, rating, comment) VALUES ($1, $2, $3, $4, $5)`,
        [req.userId, messageId || null, conversationId || null, rating, comment || null]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Feedback error:", err);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  app.get("/api/feedback/summary", requireAuth, async (req, res) => {
    try {
      const { query: dbQuery } = await import("./db");
      const rows = await dbQuery<{ rating: string; count: string }>(
        `SELECT rating, COUNT(*)::text as count FROM feedback WHERE user_id = $1 GROUP BY rating`,
        [req.userId]
      );
      const summary: Record<string, number> = { up: 0, down: 0 };
      for (const r of rows) summary[r.rating] = parseInt(r.count);
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch feedback summary" });
    }
  });

  // ─── CONVERSATION BRANCHING ────────────────────────────────────────────
  app.post("/api/conversations/branch", requireAuth, async (req, res) => {
    try {
      const { conversationId, messageId } = req.body;
      if (!conversationId || !messageId) {
        return res.status(400).json({ error: "conversationId and messageId required" });
      }

      const { query: dbQuery, queryOne: dbQueryOne } = await import("./db");

      // Verify ownership
      const conv = await dbQueryOne<any>(
        "SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2",
        [conversationId, req.userId]
      );
      if (!conv) return res.status(404).json({ error: "Conversation not found" });

      // Create branch conversation
      const branch = await dbQueryOne<any>(
        `INSERT INTO conversations (user_id, title, parent_conversation_id, branch_point_message_id)
         VALUES ($1, $2, $3, $4) RETURNING id, title, created_at`,
        [req.userId, `Branch of: ${conv.title}`, conversationId, messageId]
      );

      // Copy messages up to the branch point into the new conversation
      await dbQuery(
        `INSERT INTO messages (conversation_id, role, content_plaintext, content_encrypted, is_encrypted, type, mode, confidence, created_at)
         SELECT $1, role, content_plaintext, content_encrypted, is_encrypted, type, mode, confidence, created_at
         FROM messages WHERE conversation_id = $2 AND created_at <= (SELECT created_at FROM messages WHERE id = $3)
         ORDER BY created_at`,
        [branch.id, conversationId, messageId]
      );

      res.json({ branchId: branch.id, title: branch.title });
    } catch (err) {
      console.error("Branch error:", err);
      res.status(500).json({ error: "Failed to create branch" });
    }
  });

  // ─── DATA EXPORT (GDPR Article 20) ─────────────────────────────────────
  app.get("/api/export/all", requireAuth, async (req, res) => {
    try {
      const { exportUserData, tasksToCSV, projectsToCSV } = await import("./export-engine");
      const data = await exportUserData(req.userId!);

      // Build a JSON package with all data
      const exportPackage = {
        metadata: data.metadata,
        conversations: data.conversations,
        memories: data.memories,
        tasks: data.tasks,
        projects: data.projects,
        crafts: data.crafts.map((c) => ({ ...c, filePath: undefined })), // Don't expose server paths
        tasks_csv: tasksToCSV(data.tasks),
        projects_csv: projectsToCSV(data.projects),
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="aura-export-${new Date().toISOString().split("T")[0]}.json"`);
      res.json(exportPackage);
    } catch (err) {
      console.error("Export error:", err);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // ─── MCP CONNECTIONS ───────────────────────────────────────────────────
  (() => {
    const mcpImports = {
      registry: require("./mcp-registry") as typeof import("./mcp-registry"),
      client: require("./mcp-client") as typeof import("./mcp-client"),
    };

    app.get("/api/mcp/connections", requireAuth, async (req, res) => {
      try {
        const connections = await mcpImports.registry.listConnections(req.userId!);
        res.json(connections);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch connections" });
      }
    });

    app.post("/api/mcp/connections", requireAuth, async (req, res) => {
      try {
        const { serverName, serverUrl, transport } = req.body;
        if (!serverName || !serverUrl) return res.status(400).json({ error: "serverName and serverUrl required" });

        const conn = await mcpImports.registry.addConnection(req.userId!, serverName, serverUrl, transport);

        // Try to connect and discover tools
        const tools = await mcpImports.client.connectToServer(conn.id, serverUrl, serverName);
        res.json({ connection: conn, tools });
      } catch (err) {
        console.error("MCP connection error:", err);
        res.status(500).json({ error: "Failed to add connection" });
      }
    });

    app.delete("/api/mcp/connections/:id", requireAuth, async (req, res) => {
      try {
        await mcpImports.client.disconnectServer(req.params.id as string);
        const removed = await mcpImports.registry.removeConnection(req.params.id as string, req.userId!);
        if (!removed) return res.status(404).json({ error: "Connection not found" });
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: "Failed to remove connection" });
      }
    });

    app.post("/api/mcp/tools/:connectionId/call", requireAuth, async (req, res) => {
      try {
        const { tool, args } = req.body;
        if (!tool) return res.status(400).json({ error: "tool name required" });

        // Verify ownership
        const conn = await mcpImports.registry.getConnection(req.params.connectionId as string, req.userId!);
        if (!conn) return res.status(404).json({ error: "Connection not found" });

        const result = await mcpImports.client.executeTool(conn.id, tool, args || {});
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: "Tool execution failed" });
      }
    });
  })();

  // ─── MEMORY CONSOLIDATION ──────────────────────────────────────────────
  app.get("/api/memory/consolidation-status", requireAuth, async (req, res) => {
    try {
      const status = await getConsolidationStatus(req.userId!);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: "Failed to get consolidation status" });
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
    const skill = getSkill(req.params.id as string);
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
