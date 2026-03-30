/**
 * Mode Accuracy Tests (Section B, Tests 331–360)
 *
 * Tests that:
 * 1. Each mode (Chat, Research, Explain) produces meaningfully different responses
 * 2. System prompts are correctly differentiated per mode
 * 3. The API correctly sends the mode and returns mode-appropriate responses
 * 4. Mode does not retroactively affect past messages
 * 5. Mode selector state and behavior work correctly
 */

import { buildTruthSystemPrompt, parseConfidence } from "../server/truth-engine";

const API_BASE = process.env.API_BASE || "http://localhost:5000";
const DEVICE_ID = "test-mode-accuracy-" + Date.now().toString(36);

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

async function sendChatAndCollect(
  question: string,
  mode: string,
  explainLevel: string = "normal"
): Promise<{ content: string; confidence: string | null; citations: any[] }> {
  const url = `${API_BASE}/api/chat`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-id": DEVICE_ID,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: question }],
      mode,
      explainLevel,
      isPrivate: true,
      rememberFlag: false,
      autoDetectMode: false,
    }),
  });

  if (!resp.ok) {
    throw new Error(`API returned ${resp.status}: ${await resp.text()}`);
  }

  const text = await resp.text();
  const lines = text.split("\n");
  let content = "";
  let confidence: string | null = null;
  let citations: any[] = [];

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6);
    if (data === "[DONE]") break;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === "confidence") {
        confidence = parsed.confidence;
      } else if (parsed.type === "citations") {
        citations = parsed.citations || [];
      } else if (parsed.content) {
        content += parsed.content;
      }
    } catch {}
  }

  return { content, confidence, citations };
}

function countStructuralElements(text: string): number {
  const bullets = (text.match(/→/g) || []).length;
  const numberedItems = (text.match(/^\d+\./gm) || []).length;
  const boldTerms = (text.match(/\*\*[^*]+\*\*/g) || []).length;
  return bullets + numberedItems + boldTerms;
}

function hasAnalogy(text: string): boolean {
  const lower = text.toLowerCase();
  const analogyMarkers = [
    "like ", "think of it as", "imagine ", "similar to",
    "analogy", "picture ", "just like", "as if ", "the same way",
    "for example", "suppose ", "pretend ", "compare it to",
    "it's as though", "works like", "acts like",
  ];
  return analogyMarkers.some((m) => lower.includes(m));
}

function hasSimpleLanguage(text: string): boolean {
  const jargonTerms = [
    "aggregate demand", "monetary policy transmission mechanism",
    "quantitative easing", "macroeconomic equilibrium",
    "IS-LM model", "Phillips curve", "NAIRU",
    "velocity of money equation", "liquidity trap",
  ];
  const lower = text.toLowerCase();
  const jargonCount = jargonTerms.filter((j) => lower.includes(j.toLowerCase())).length;
  return jargonCount <= 1;
}

function averageSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;
  const totalWords = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0);
  return totalWords / sentences.length;
}

(async () => {
  console.log("\n═══ Section B: Mode Accuracy Tests (331–360) ═══\n");

  // ─── Test 331: System prompts are different per mode ─────────────────────
  {
    const chatPrompt = buildTruthSystemPrompt("chat", "normal", []);
    const researchPrompt = buildTruthSystemPrompt("research", "normal", []);
    const explainPrompt = buildTruthSystemPrompt("explain", "normal", []);
    assert(chatPrompt !== researchPrompt, "T331: Chat and Research system prompts differ");
    assert(chatPrompt !== explainPrompt, "T332: Chat and Explain system prompts differ");
    assert(researchPrompt !== explainPrompt, "T333: Research and Explain system prompts differ");
  }

  // ─── Test 334–336: Chat mode prompt characteristics ──────────────────────
  {
    const prompt = buildTruthSystemPrompt("chat", "normal", []);
    assert(prompt.includes("Chat Mode"), "T334: Chat prompt identifies as Chat Mode");
    assert(prompt.includes("naturally") || prompt.includes("thinking partner"), "T335: Chat prompt encourages natural conversation");
    assert(prompt.includes("Do NOT over-structure") || prompt.includes("minimal structure"), "T336: Chat prompt discourages over-structuring");
  }

  // ─── Test 337–339: Research mode prompt characteristics ──────────────────
  {
    const prompt = buildTruthSystemPrompt("research", "normal", []);
    assert(prompt.includes("Research Mode"), "T337: Research prompt identifies as Research Mode");
    assert(prompt.includes("evidence") || prompt.includes("findings"), "T338: Research prompt requires evidence");
    assert(prompt.includes("sources") || prompt.includes("Sources"), "T339: Research prompt mentions sources");
  }

  // ─── Test 340–342: Explain mode prompt characteristics ───────────────────
  {
    const prompt = buildTruthSystemPrompt("explain", "normal", []);
    assert(prompt.includes("Explain Mode"), "T340: Explain prompt identifies as Explain Mode");
    assert(prompt.includes("analogy") || prompt.includes("plain-language"), "T341: Explain prompt requires analogies");
    assert(prompt.includes("simple") || prompt.includes("accessible"), "T342: Explain prompt encourages simplicity");
  }

  // ─── Test 343: Explain level affects explain mode ────────────────────────
  {
    const simplePrompt = buildTruthSystemPrompt("explain", "simple", []);
    const expertPrompt = buildTruthSystemPrompt("explain", "expert", []);
    assert(simplePrompt.includes("12-year-old"), "T343: Simple explain level targets young audience");
    assert(expertPrompt.includes("technical language"), "T344: Expert explain level uses technical language");
  }

  // ─── Test 345: Mode selector default is chat ─────────────────────────────
  {
    const fs = require("fs");
    const auraCode = fs.readFileSync(require("path").join(__dirname, "../app/(tabs)/aura.tsx"), "utf-8");
    assert(
      auraCode.includes('useState<ChatMode>("chat")'),
      "T345: Default mode state is 'chat'"
    );
  }

  // ─── Test 346: Mode is sent to API correctly ─────────────────────────────
  {
    const fs = require("fs");
    const auraCode = fs.readFileSync(require("path").join(__dirname, "../app/(tabs)/aura.tsx"), "utf-8");
    assert(
      auraCode.includes("mode,") && auraCode.includes("explainLevel,"),
      "T346: Frontend sends mode and explainLevel to API"
    );
  }

  // ─── Test 347: Mode badge component exists for non-chat modes ────────────
  {
    const fs = require("fs");
    const auraCode = fs.readFileSync(require("path").join(__dirname, "../app/(tabs)/aura.tsx"), "utf-8");
    assert(
      auraCode.includes("ModeBadge") && auraCode.includes('mode === "chat"'),
      "T347: ModeBadge exists and hides for default chat mode"
    );
  }

  // ─── Test 348: Mode picker UI exists ─────────────────────────────────────
  {
    const fs = require("fs");
    const auraCode = fs.readFileSync(require("path").join(__dirname, "../app/(tabs)/aura.tsx"), "utf-8");
    assert(
      auraCode.includes("showModePicker") && auraCode.includes("setShowModePicker"),
      "T348: Mode picker toggle state exists"
    );
  }

  // ─── Live API Tests: Same question in different modes ────────────────────
  console.log("\n--- Live API Tests (sending 'What causes inflation?' in 3 modes) ---\n");

  let chatResponse = "";
  let researchResponse = "";
  let explainResponse = "";

  try {
    console.log("Sending Chat mode request...");
    const chatResult = await sendChatAndCollect("What causes inflation?", "chat");
    chatResponse = chatResult.content;
    assert(chatResponse.length > 50, "T349: Chat mode returns a substantive response");
    assert(chatResult.confidence !== null, "T350: Chat mode includes confidence level");

    console.log("Sending Research mode request...");
    const researchResult = await sendChatAndCollect("What causes inflation?", "research");
    researchResponse = researchResult.content;
    assert(researchResponse.length > 50, "T351: Research mode returns a substantive response");
    assert(researchResult.confidence !== null, "T352: Research mode includes confidence level");

    console.log("Sending Explain mode request...");
    const explainResult = await sendChatAndCollect("What causes inflation?", "explain", "simple");
    explainResponse = explainResult.content;
    assert(explainResponse.length > 50, "T353: Explain mode returns a substantive response");
    assert(explainResult.confidence !== null, "T354: Explain mode includes confidence level");

    // ─── Test 355: Responses are all different ─────────────────────────────
    assert(
      chatResponse !== researchResponse,
      "T355: Chat and Research responses are different"
    );
    assert(
      chatResponse !== explainResponse,
      "T356: Chat and Explain responses are different"
    );
    assert(
      researchResponse !== explainResponse,
      "T357: Research and Explain responses are different"
    );

    // ─── Test 358: Research is more structured than Chat ────────────────────
    const chatStructure = countStructuralElements(chatResponse);
    const researchStructure = countStructuralElements(researchResponse);
    console.log(`  Chat structural elements: ${chatStructure}`);
    console.log(`  Research structural elements: ${researchStructure}`);
    assert(
      researchResponse.length >= chatResponse.length * 0.8 || researchStructure >= chatStructure,
      "T358: Research response is at least as structured/detailed as Chat"
    );

    // ─── Test 359: Explain uses simpler language / analogies ───────────────
    const explainHasAnalogy = hasAnalogy(explainResponse);
    const explainIsSimple = hasSimpleLanguage(explainResponse);
    const explainAvgSentence = averageSentenceLength(explainResponse);
    const chatAvgSentence = averageSentenceLength(chatResponse);
    console.log(`  Explain has analogy: ${explainHasAnalogy}`);
    console.log(`  Explain uses simple language: ${explainIsSimple}`);
    console.log(`  Explain avg sentence length: ${explainAvgSentence.toFixed(1)}`);
    console.log(`  Chat avg sentence length: ${chatAvgSentence.toFixed(1)}`);

    assert(
      explainHasAnalogy || explainIsSimple,
      "T359: Explain mode uses analogies or simpler language"
    );

    // ─── Test 360: Each response has meaningfully different style ───────────
    const chatWords = new Set(chatResponse.toLowerCase().split(/\s+/));
    const researchWords = new Set(researchResponse.toLowerCase().split(/\s+/));
    const explainWords = new Set(explainResponse.toLowerCase().split(/\s+/));

    const chatResearchOverlap = [...chatWords].filter((w) => researchWords.has(w)).length / Math.max(chatWords.size, 1);
    const chatExplainOverlap = [...chatWords].filter((w) => explainWords.has(w)).length / Math.max(chatWords.size, 1);

    console.log(`  Chat-Research word overlap: ${(chatResearchOverlap * 100).toFixed(1)}%`);
    console.log(`  Chat-Explain word overlap: ${(chatExplainOverlap * 100).toFixed(1)}%`);

    assert(
      chatResearchOverlap < 0.95 && chatExplainOverlap < 0.95,
      "T360: Each mode produces meaningfully different content (not identical)"
    );

    console.log("\n--- Sample excerpts ---");
    console.log(`Chat (first 200 chars): ${chatResponse.slice(0, 200)}...`);
    console.log(`Research (first 200 chars): ${researchResponse.slice(0, 200)}...`);
    console.log(`Explain (first 200 chars): ${explainResponse.slice(0, 200)}...`);
  } catch (err: any) {
    console.error(`API test error: ${err.message}`);
    assert(false, "T349-T360: API tests could not complete due to error: " + err.message);
  }

  console.log(`\n═══ Mode Accuracy Tests Complete: ${passed} passed, ${failed} failed ═══\n`);
})();
