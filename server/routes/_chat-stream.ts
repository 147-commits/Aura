/**
 * Streaming chat handler for POST /api/chat.
 *
 * Extracted from chat.ts so the router file stays under the 300-line target.
 * Handles: mode detection, skill routing, attachment processing, research
 * short-circuit, streamed model output, verification pipeline, memory
 * persistence, cost tracking.
 */

import type { Request, Response } from "express";
import {
  buildTruthSystemPrompt,
  parseConfidence,
  parseDocumentRequest,
  parseCraftRequest,
  parseActionItems,
  detectMode,
  detectStressSignals,
  type ChatMode,
  type AgentContext,
} from "../truth-engine";
import {
  getAgent,
  getAgentsByDomain,
} from "../agents/agent-registry";
import type {
  AgentDefinition,
  AdvisorDomain,
} from "../../shared/agent-schema";
import { routeAgents, composeChainedPrompt, type RouteResult } from "../agents/agent-router";
import { classifyIntent } from "../orchestrator/intent-classifier";
import { generateCraft } from "../craft-engine";
import { runResearch } from "../research-engine";
import { shouldCheckConsolidation, runConsolidation } from "../memory-consolidator";
import { generateSuggestions } from "../suggestions-engine";
import { hybridSearch, type RetrievalResult } from "../retrieval-engine";
import { chainOfVerification, applyDomainCalibration } from "../verification-engine";
import { processAttachment, buildAttachmentContext, type ProcessedAttachment } from "../file-engine";
import {
  getOrCreateConversation,
  getMemories,
  extractAndSaveMemories,
  saveMessage,
  saveCitations,
} from "../memory-engine";
import { selectModel, trackCompletion } from "../model-router";
import { createStream } from "../ai-provider";
import { validateConfidenceInResponse } from "../confidence-calibrator";
import {
  openai,
  perfLog,
  estimateTokens,
  COST_PER_1M_INPUT,
  conversationHeartbeat,
  getAllSkillIds,
} from "./_shared";

export async function handleChatStream(req: Request, res: Response): Promise<void> {
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

    // ─── Parallel detection: mode + domain ─────────────────────────
    const detectionStart = Date.now();

    const activeProjectContext = dbMemory
      .filter((m) => m.category === "project")
      .map((m) => m.text)
      .join("; ")
      .slice(0, 100);

    const needsModeDetect = autoDetectMode && !requestedMode;

    const [detectedMode, agentRoute] = await Promise.all([
      needsModeDetect
        ? detectMode(lastUserMessage, openai)
        : Promise.resolve(requestedMode || "chat" as ChatMode),
      routeAgents(lastUserMessage, activeProjectContext, dbMemory, openai).catch((err): RouteResult => {
        console.warn("[agent-router] routeAgents failed, continuing without agent:", err);
        return { primary: "engineering", secondary: null, layer: "heuristic" };
      }),
    ]);

    const mode: ChatMode = detectedMode;
    const detectionMs = Date.now() - detectionStart;
    perfLog({ step: "parallel-detection", ms: detectionMs, mode, domain: agentRoute.primary, layer: agentRoute.layer });

    if (needsModeDetect) {
      res.write(`data: ${JSON.stringify({ type: "mode", mode })}\n\n`);
    }

    // ─── Intent classification (build vs chat) ────────────────────
    // Rule-only by default to keep the chat hot path fast — the LLM
    // fallback adds ~200ms which is a meaningful tax on every send.
    // The frontend can re-classify via /api/pipeline/start if needed.
    const intent = await classifyIntent(lastUserMessage, { ruleOnly: true });
    perfLog({ step: "intent-classification", intent: intent.intent, confidence: intent.confidence, layer: intent.layer });
    if (intent.intent === "build" || intent.intent === "build-extend") {
      res.write(`data: ${JSON.stringify({
        type: "build_detected",
        intent: intent.intent,
        confidence: intent.confidence,
        reason: intent.reason,
      })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    if (intent.intent === "ambiguous") {
      res.write(`data: ${JSON.stringify({
        type: "clarification_needed",
        message: "I'm not sure if you want me to build something or chat about it. Could you clarify?",
        confidence: intent.confidence,
        reason: intent.reason,
      })}\n\n`);
      // Continue with the chat flow — we still answer; the client can
      // surface a "start a pipeline run" button alongside.
    }

    // ─── Agent resolution ──────────────────────────────────────────
    let activeAgent: AgentDefinition | undefined;
    let agentContext: AgentContext | undefined;
    let chainedPromptOverride: string | undefined;
    let detectedSkill: {
      primary: AdvisorDomain | null;
      secondary: AdvisorDomain | null;
      wasAutoDetected: boolean;
      skillName: string | null;
    } | null = null;

    if (activeSkillId) {
      activeAgent = getAgent(activeSkillId);
      if (!activeAgent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Unknown skill ID", validSkills: getAllSkillIds() })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      agentContext = { userMessage: lastUserMessage, chainedAgentIds: activeAgent.chainsWith };
      detectedSkill = { primary: activeAgent.domain as AdvisorDomain, secondary: null, wasAutoDetected: false, skillName: activeAgent.name };
      console.log(`[routing] Client-specified agent: ${activeAgent.id} (${detectionMs}ms)`);
    } else if (agentRoute.secondary) {
      const primaryAgents = getAgentsByDomain(agentRoute.primary);
      const secondaryAgents = getAgentsByDomain(agentRoute.secondary);
      if (primaryAgents.length > 0 && secondaryAgents.length > 0) {
        activeAgent = primaryAgents[0];
        const secondaryAgent = secondaryAgents[0];
        agentContext = { userMessage: lastUserMessage, chainedAgentIds: activeAgent.chainsWith };
        chainedPromptOverride = composeChainedPrompt(activeAgent, secondaryAgent, agentContext);
        detectedSkill = {
          primary: agentRoute.primary,
          secondary: agentRoute.secondary,
          wasAutoDetected: true,
          skillName: `${activeAgent.name} + ${secondaryAgent.name}`,
        };
        console.log(`[routing] Chained: ${activeAgent.id} + ${secondaryAgent.id} (layer: ${agentRoute.layer}, ${detectionMs}ms)`);
      }
    } else if (agentRoute.primary) {
      const domainAgents = getAgentsByDomain(agentRoute.primary);
      if (domainAgents.length > 0) {
        activeAgent = domainAgents[0];
        agentContext = { userMessage: lastUserMessage, chainedAgentIds: activeAgent.chainsWith };
        detectedSkill = { primary: agentRoute.primary, secondary: null, wasAutoDetected: true, skillName: activeAgent.name };
        console.log(`[routing] Auto-detected: ${activeAgent.id} (layer: ${agentRoute.layer}, ${detectionMs}ms)`);
      }
    }

    if (detectedSkill) {
      res.write(`data: ${JSON.stringify({ type: "skill_active", ...detectedSkill })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: "status", step: "thinking", message: "Understanding your question..." })}\n\n`);

    const isTriage = detectStressSignals(lastUserMessage);
    const promptStart = Date.now();
    const systemPrompt = chainedPromptOverride
      ? buildTruthSystemPrompt(mode, explainLevel, dbMemory, { isTriage }) +
        "\n\n---\nACTIVE DOMAIN EXPERTISE:\n" + chainedPromptOverride
      : buildTruthSystemPrompt(mode, explainLevel, dbMemory, { isTriage, activeAgent, agentContext });
    perfLog({ step: "prompt-build", ms: Date.now() - promptStart, skill: activeAgent?.id || null });

    const promptTokens = estimateTokens(systemPrompt);
    perfLog({ event: "prompt-tokens", estimated: promptTokens, skill: activeAgent?.id || null });
    if (promptTokens > 3000) {
      console.warn(`[token-audit] System prompt exceeds 3000 tokens: ~${promptTokens} (skill: ${activeAgent?.id || "none"})`);
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

    // ─── Standard chat with model routing ──────────────────────────
    const modelConfig = selectModel(mode, lastUserMessage, {
      activeSkillDomain: activeAgent?.domain,
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

    res.write(`data: ${JSON.stringify({ type: "status", step: "composing", message: "Putting it all together..." })}\n\n`);

    const stream = createStream(modelConfig.modelId, chatMessages, modelConfig.maxTokens);

    let fullContent = "";
    let actionMarkerDetected = false;
    try {
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
    } catch (streamErr: any) {
      // The model call failed mid-stream (bad model name, rate limit, key
      // expired, etc.). Surface a structured error event to the client
      // instead of silently writing [DONE] — the previous behavior left
      // users staring at an empty assistant bubble with no diagnosis.
      const status = streamErr?.status ?? streamErr?.response?.status;
      const detail = streamErr?.error?.error?.message ?? streamErr?.message ?? String(streamErr);
      console.error(
        `[chat] model stream failed (model=${modelConfig.model}, tier=${modelConfig.tier}, status=${status}):`,
        detail
      );
      res.write(`data: ${JSON.stringify({
        type: "stream_error",
        model: modelConfig.model,
        tier: modelConfig.tier,
        status: status ?? null,
        message: detail,
      })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const { cleanContent: preActionContent, actionItems } = parseActionItems(fullContent);
    const { cleanContent: preConfContent, confidence, confidenceReason } = parseConfidence(preActionContent);
    const { cleanContent: preCraftContent, craftRequest } = parseCraftRequest(preConfContent);
    const { cleanContent, documentRequest } = parseDocumentRequest(preCraftContent);

    // ─── Verification pipeline (decision mode) ────────────────────
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

        const finalLevel = activeAgent
          ? applyDomainCalibration(verification.overallConfidence, confidence as "High" | "Medium" | "Low")
          : verification.overallConfidence;

        compositeScore = verification.compositeScore;
        compositeLevel = finalLevel;

        res.write(`data: ${JSON.stringify({
          type: "composite_confidence",
          score: verification.compositeScore,
          level: finalLevel,
          breakdown: { claims: verification.verifiedClaims.length, disclaimers: verification.disclaimers },
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
      if (rememberFlag) {
        try {
          const savedMemories = await extractAndSaveMemories(userId, lastUserMessage, openai);
          if (savedMemories.length > 0) {
            res.write(`data: ${JSON.stringify({
              type: "memory_saved",
              memories: savedMemories.map((m) => ({ category: m.category, text: m.text })),
            })}\n\n`);
          }
        } catch (memErr) { console.error("Memory extraction error:", memErr); }
      }
      await conversationHeartbeat(conversationId);
      if (shouldCheckConsolidation(userId)) {
        runConsolidation(userId).catch((err) => console.warn("[consolidator] Async consolidation failed:", err));
      }
    }

    if (userId) trackCompletion(userId, lastUserMessage, fullContent, modelConfig.tier);

    // ─── Confidence monitoring ────────────────────────────────────
    if (activeAgent && confidence) {
      const validation = validateConfidenceInResponse(fullContent, activeAgent.domain);
      if (!validation.isAppropriate) {
        perfLog({ event: "confidence-overclaim", skill: activeAgent.id, claimed: validation.claimed, warning: validation.warning });
      }
    }

    // ─── Cost estimate ────────────────────────────────────────────
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
      skill: activeAgent?.id || null,
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
}
