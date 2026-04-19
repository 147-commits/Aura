/**
 * Section C — Quick Action Correctness Tests (361–400)
 *
 * Tests that each quick action mode (Plan, Summarize, Brainstorm, Decide)
 * produces the correct type of response when used via the /api/chat endpoint.
 */

const BASE_URL = process.env.AURA_TEST_BASE_URL || "http://127.0.0.1:5000";
const DEVICE_ID = "test-quick-action-" + Date.now().toString(36);

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

async function sendChat(
  messages: { role: string; content: string }[],
  mode: string = "chat"
): Promise<string> {
  const resp = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-id": DEVICE_ID,
    },
    body: JSON.stringify({
      messages,
      mode,
      explainLevel: "normal",
      isPrivate: false,
      rememberFlag: false,
      autoDetectMode: false,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Chat API failed: ${resp.status} ${resp.statusText}`);
  }

  const text = await resp.text();
  const lines = text.split("\n");
  let fullContent = "";

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6);
    if (data === "[DONE]") break;
    try {
      const parsed = JSON.parse(data);
      if (parsed.content) {
        fullContent += parsed.content;
      }
    } catch {}
  }

  return fullContent
    .replace(/\|\|\|ACTION_ITEMS\|\|\|[\s\S]*$/, "")
    .replace(/\|\|\|DOCUMENT_REQUEST\|\|\|[\s\S]*$/, "")
    .replace(/^Confidence:\s*(High|Medium|Low)\s*(?:\([^)]*\))?\s*$/gm, "")
    .trim();
}

async function runTests() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Section C — Quick Action Correctness Tests (361–400)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const contextMessage =
    "I'm thinking about starting a side project. Maybe a mobile app for tracking habits, or a blog about productivity, or a YouTube channel about tech reviews. I want something that can eventually make money but fits around my full-time job.";

  const conversationHistory: { role: string; content: string }[] = [
    { role: "user", content: contextMessage },
  ];

  // ─── Step 1: Initial context message ───────────────────────────────────────
  console.log("--- Setup: Sending initial context message ---");
  const initialResp = await sendChat(conversationHistory, "chat");
  console.log(`Initial response length: ${initialResp.length} chars`);
  assert(initialResp.length > 50, "Initial response is substantive (>50 chars)");

  conversationHistory.push({ role: "assistant", content: initialResp });

  // ─── TEST 361-370: Plan produces actionable plan ─────────────────────────────
  console.log("\n--- TEST: Plan produces actionable plan ---");
  const planMessages = [
    ...conversationHistory,
    { role: "user", content: "Create a plan for my side project" },
  ];
  const planResp = await sendChat(planMessages, "chat");
  console.log(`Plan response (${planResp.length} chars):\n${planResp.slice(0, 500)}...\n`);

  const planLower = planResp.toLowerCase();

  const actionWords = ["step", "start", "create", "build", "launch", "set up", "define", "research", "validate", "develop", "design", "test", "plan", "schedule", "prioritize", "first", "next", "then", "begin", "identify"];
  const hasActionWords = actionWords.filter((w) => planLower.includes(w));
  assert(hasActionWords.length >= 3, `[361] Plan includes concrete action words (found ${hasActionWords.length}: ${hasActionWords.join(", ")})`);

  const hasSteps = /(\d+[\.\):]|\bstep\b|\bphase\b|\bweek\b|→)/i.test(planResp);
  assert(hasSteps, "[362] Plan has structured steps/phases/numbered items");

  const hasForwardLooking = /(should|will|can|could|would|start|begin|launch|goal|timeline|milestone|deadline|target)/i.test(planResp);
  assert(hasForwardLooking, "[363] Plan is forward-looking (contains future-oriented language)");

  const hasPriorities = /(first|priority|important|focus|key|main|primary|critical|essential|initial)/i.test(planResp);
  assert(hasPriorities, "[364] Plan has a logical order of priorities");

  const planMentionsTopics = (planLower.includes("habit") || planLower.includes("app")) ||
    planLower.includes("blog") || planLower.includes("youtube") || planLower.includes("channel");
  assert(planMentionsTopics, "[365] Plan references the user's actual project ideas");

  assert(planResp.length > 200, "[366] Plan is substantive enough (>200 chars)");

  const planIsNotJustSummary = hasActionWords.length >= 3 && hasForwardLooking;
  assert(planIsNotJustSummary, "[367] Plan creates forward-looking plan, not just summary");

  conversationHistory.push({ role: "user", content: "Create a plan for my side project" });
  conversationHistory.push({ role: "assistant", content: planResp });

  // ─── TEST 371-380: Summarize produces concise recap ──────────────────────────
  console.log("\n--- TEST: Summarize produces concise recap ---");
  const summarizeMessages = [
    ...conversationHistory,
    { role: "user", content: "Summarize our conversation" },
  ];
  const summarizeResp = await sendChat(summarizeMessages, "chat");
  console.log(`Summarize response (${summarizeResp.length} chars):\n${summarizeResp.slice(0, 500)}...\n`);

  const sumLower = summarizeResp.toLowerCase();

  const totalConversationLength = conversationHistory.reduce((sum, m) => sum + m.content.length, 0);
  assert(
    summarizeResp.length < totalConversationLength,
    `[371] Summary is shorter than original conversation (${summarizeResp.length} < ${totalConversationLength})`
  );

  const mentionsHabitTracker = sumLower.includes("habit") || sumLower.includes("tracker") || sumLower.includes("app");
  const mentionsBlog = sumLower.includes("blog") || sumLower.includes("productivity");
  const mentionsYoutube = sumLower.includes("youtube") || sumLower.includes("channel") || sumLower.includes("tech review");
  const mentionsMoney = sumLower.includes("money") || sumLower.includes("monetiz") || sumLower.includes("income") || sumLower.includes("revenue");
  const mentionsJob = sumLower.includes("job") || sumLower.includes("full-time") || sumLower.includes("work");

  const keyPointsCaptured = [mentionsHabitTracker, mentionsBlog, mentionsYoutube, mentionsMoney, mentionsJob].filter(Boolean).length;
  assert(keyPointsCaptured >= 2, `[372] Summary captures key points (${keyPointsCaptured}/5 key topics mentioned)`);

  assert(summarizeResp.length > 50, "[373] Summary is substantive (>50 chars)");
  assert(summarizeResp.length < 2000, "[374] Summary is concise (<2000 chars)");

  const novelTopics = ["cryptocurrency", "real estate", "cooking", "fitness trainer", "photography"];
  const hasNovelTopics = novelTopics.some((t) => sumLower.includes(t));
  assert(!hasNovelTopics, "[375] Summary does NOT add new ideas never discussed");

  const mentionsSideProject = sumLower.includes("side project") || sumLower.includes("project");
  assert(mentionsSideProject, "[376] Summary mentions the core topic (side project)");

  assert(summarizeResp.length < planResp.length * 2, "[377] Summary is reasonably concise relative to plan");

  conversationHistory.push({ role: "user", content: "Summarize our conversation" });
  conversationHistory.push({ role: "assistant", content: summarizeResp });

  // ─── TEST 381-390: Brainstorm generates diverse ideas ────────────────────────
  console.log("\n--- TEST: Brainstorm generates diverse ideas ---");
  const brainstormMessages = [
    ...conversationHistory,
    { role: "user", content: "Give me more side project ideas" },
  ];
  const brainstormResp = await sendChat(brainstormMessages, "brainstorm");
  console.log(`Brainstorm response (${brainstormResp.length} chars):\n${brainstormResp.slice(0, 800)}...\n`);

  const bsLower = brainstormResp.toLowerCase();

  const numberedItems = brainstormResp.match(/(?:^|\n)\s*\d+[\.\)]/gm);
  const bulletItems = brainstormResp.match(/→/g);
  const ideaCount = Math.max(numberedItems?.length || 0, Math.floor((bulletItems?.length || 0) / 1));
  assert(ideaCount >= 5, `[381] Brainstorm contains at least 5 ideas (found ~${ideaCount} numbered/bulleted items)`);

  assert(brainstormResp.length > 300, "[382] Brainstorm response is substantial (>300 chars)");

  const staysOnTopic = bsLower.includes("project") || bsLower.includes("idea") || bsLower.includes("app") ||
    bsLower.includes("business") || bsLower.includes("side") || bsLower.includes("build") || bsLower.includes("create");
  assert(staysOnTopic, "[383] Brainstorm stays on topic (side projects/ideas)");

  const hasCreativeLanguage = /(idea|concept|approach|try|consider|explore|option|alternative|possibility|what if|how about)/i.test(brainstormResp);
  assert(hasCreativeLanguage, "[384] Brainstorm feels ideation-focused");

  const isNotRigidPlan = !(/^(step 1|phase 1|week 1)/im.test(brainstormResp) && !/idea/i.test(brainstormResp));
  assert(isNotRigidPlan, "[385] Brainstorm is NOT a rigid sequential plan");

  const words = brainstormResp.split(/\s+/);
  assert(words.length > 50, `[386] Brainstorm has sufficient detail (${words.length} words)`);

  const paragraphs = brainstormResp.split(/\n\n+/).filter((p) => p.trim().length > 20);
  assert(paragraphs.length >= 3, `[387] Brainstorm has multiple distinct sections (${paragraphs.length})`);

  const diverseTopicIndicators = [
    /app|mobile|software/i,
    /blog|writ|content/i,
    /youtube|video|channel/i,
    /course|teach|tutor/i,
    /newsletter|email/i,
    /saas|service|tool/i,
    /freelanc|consult/i,
    /communit|forum|discord/i,
    /podcast|audio/i,
    /ecommerce|shop|store|product/i,
    /template|design|theme/i,
    /automat|bot/i,
  ];
  const topicsDiversity = diverseTopicIndicators.filter((r) => r.test(brainstormResp)).length;
  assert(topicsDiversity >= 3, `[388] Ideas are genuinely diverse (${topicsDiversity} different topic categories detected)`);

  conversationHistory.push({ role: "user", content: "Give me more side project ideas" });
  conversationHistory.push({ role: "assistant", content: brainstormResp });

  // ─── TEST 391-400: Decide produces evaluation ─────────────────────────────────
  console.log("\n--- TEST: Decide produces evaluation ---");
  const decideMessages = [
    ...conversationHistory,
    { role: "user", content: "Should I start with the habit tracker app or the YouTube channel?" },
  ];
  const decideResp = await sendChat(decideMessages, "decision");
  console.log(`Decide response (${decideResp.length} chars):\n${decideResp.slice(0, 800)}...\n`);

  const decLower = decideResp.toLowerCase();

  const mentionsHabit = decLower.includes("habit") || decLower.includes("tracker") || decLower.includes("app");
  const mentionsYT = decLower.includes("youtube") || decLower.includes("channel") || decLower.includes("video");
  assert(mentionsHabit && mentionsYT, `[391] Decision evaluates BOTH options (habit tracker: ${mentionsHabit}, YouTube: ${mentionsYT})`);

  const hasProsConsLanguage = /(pro|con|advantage|disadvantage|benefit|drawback|upside|downside|trade-?off|strength|weakness|risk|reward)/i.test(decideResp);
  assert(hasProsConsLanguage, "[392] Decision includes pros/cons or trade-off language");

  const hasRecommendation = /(recommend|suggest|would go with|start with|best|my pick|lean toward|advise|go for|choose|opt for|better fit|stronger choice)/i.test(decideResp);
  assert(hasRecommendation, "[393] Decision includes a clear recommendation");

  const isAnalytical = /(because|since|given|consider|factor|depend|weigh|evaluate|compare|analysis|assess|validation|monetiz|distribution|scalab|typically|clarity|requires|paths)/i.test(decideResp);
  assert(isAnalytical, "[394] Decision is analytical, not just motivational");

  const isNotGenericMotivation = !(
    /you can do anything|follow your passion|just do it|believe in yourself/i.test(decideResp) &&
    !hasProsConsLanguage
  );
  assert(isNotGenericMotivation, "[395] Decision is NOT just generic motivational advice");

  assert(decideResp.length > 200, "[396] Decision response is substantive (>200 chars)");

  const evaluatesBothSeparately = (decLower.indexOf("habit") !== -1 || decLower.indexOf("tracker") !== -1 || decLower.indexOf("app") !== -1) &&
    (decLower.indexOf("youtube") !== -1 || decLower.indexOf("channel") !== -1);
  assert(evaluatesBothSeparately, "[397] Decision evaluates both options (not just one)");

  const mentionsTimeOrEffort = /(time|hour|week|month|effort|invest|commit|schedule|full-time|part-time|bandwidth|capacity)/i.test(decideResp);
  assert(mentionsTimeOrEffort, "[398] Decision considers practical factors (time/effort)");

  const mentionsMoneyFactor = /(money|monetiz|revenue|income|cost|invest|profit|earn|financial|budget)/i.test(decideResp);
  assert(mentionsMoneyFactor, "[399] Decision considers financial factors");

  const hasStructure = decideResp.includes("→") || /\d[\.\)]/.test(decideResp) || decideResp.includes("**");
  assert(hasStructure, "[400] Decision response has some structure (bullets, numbering, or bold)");

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

runTests().catch((err) => {
  console.error("Test suite error:", err);
  process.exitCode = 1;
});
