/**
 * Section E & F — Memory Saving and Usage Tests (431–480)
 *
 * Tests memory extraction behavior:
 * 1. Casual greetings are NOT saved as memory
 * 2. Preferences ARE saved as memory (category: preference)
 * 3. Projects ARE saved as memory (category: project)
 * 4. Private mode messages are NOT saved to memory
 * 5. "What do you remember?" recalls saved memories accurately
 * 6. Memory deletion works with confirmation
 */

const BASE_URL = "http://localhost:5000";
const TEST_DEVICE_ID = "test-memory-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failCount++;
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
    passCount++;
  }
}

function headers() {
  return { "Content-Type": "application/json", "x-device-id": TEST_DEVICE_ID };
}

async function sendChatAndWait(message: string, isPrivate = false): Promise<string> {
  const resp = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
      mode: "chat",
      isPrivate,
      rememberFlag: !isPrivate,
      autoDetectMode: false,
    }),
  });

  const text = await resp.text();
  let fullContent = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ") && line !== "data: [DONE]") {
      try {
        const data = JSON.parse(line.slice(6));
        if (data.content) fullContent += data.content;
      } catch {}
    }
  }
  return fullContent;
}

async function getMemories(): Promise<any[]> {
  const resp = await fetch(`${BASE_URL}/api/memories`, {
    headers: { "x-device-id": TEST_DEVICE_ID },
  });
  return resp.json() as Promise<any[]>;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log("\n═══ Section E & F — Memory Saving and Usage Tests ═══\n");
  console.log(`Using test device ID: ${TEST_DEVICE_ID}\n`);

  // --- Setup: Clear any existing memories for this device ---
  await fetch(`${BASE_URL}/api/memories`, {
    method: "DELETE",
    headers: headers(),
  });

  const initialMemories = await getMemories();
  assert(initialMemories.length === 0, "Test 431: Starting with clean memory state");

  // --- TEST E1: Casual greeting is NOT saved as memory (Tests 432-437) ---
  console.log("\n--- TEST: Casual greeting is NOT saved as memory ---");

  const greetingResponse = await sendChatAndWait("Hey, how's it going?");
  assert(greetingResponse.length > 0, "Test 432: Got response to casual greeting");

  await sleep(6000);

  const memoriesAfterGreeting = await getMemories();
  const greetingMemories = memoriesAfterGreeting.filter(
    (m: any) =>
      m.text.toLowerCase().includes("how's it going") ||
      m.text.toLowerCase().includes("how are you") ||
      m.text.toLowerCase().includes("greeting") ||
      m.text.toLowerCase().includes("hey")
  );
  assert(greetingMemories.length === 0, "Test 433: No memory saved from casual greeting");
  assert(
    memoriesAfterGreeting.length === 0,
    "Test 434: No memories exist at all after casual greeting"
  );

  // --- TEST E2: Preference IS saved as memory (Tests 438-445) ---
  console.log("\n--- TEST: Preference IS saved as memory ---");

  const prefResponse = await sendChatAndWait("I prefer short and concise answers, no fluff");
  assert(prefResponse.length > 0, "Test 438: Got response to preference statement");

  await sleep(7000);

  const memoriesAfterPref = await getMemories();
  assert(memoriesAfterPref.length > 0, "Test 439: At least one memory saved after preference statement");

  const prefMemories = memoriesAfterPref.filter(
    (m: any) =>
      m.text.toLowerCase().includes("short") ||
      m.text.toLowerCase().includes("concise") ||
      m.text.toLowerCase().includes("no fluff") ||
      m.text.toLowerCase().includes("brief")
  );
  assert(prefMemories.length > 0, "Test 440: Memory about short/concise answers exists");

  if (prefMemories.length > 0) {
    assert(
      prefMemories[0].category === "preference",
      `Test 441: Memory categorized as "preference" (got: "${prefMemories[0].category}")`
    );
    assert(
      prefMemories[0].text.length > 5 && prefMemories[0].text.length < 200,
      "Test 442: Memory text is reasonable length"
    );
    assert(
      typeof prefMemories[0].confidence === "string",
      "Test 443: Memory has confidence field"
    );
  } else {
    assert(false, "Test 441: (skipped - no preference memory found)");
    assert(false, "Test 442: (skipped - no preference memory found)");
    assert(false, "Test 443: (skipped - no preference memory found)");
  }

  // --- TEST E3: Project IS saved as memory (Tests 446-453) ---
  console.log("\n--- TEST: Project IS saved as memory ---");

  const projectResponse = await sendChatAndWait(
    "I'm building a fitness tracking app called FitPulse"
  );
  assert(projectResponse.length > 0, "Test 446: Got response to project statement");

  await sleep(7000);

  const memoriesAfterProject = await getMemories();
  const projectMemories = memoriesAfterProject.filter(
    (m: any) =>
      m.text.toLowerCase().includes("fitpulse") ||
      m.text.toLowerCase().includes("fitness") ||
      m.text.toLowerCase().includes("tracking app")
  );
  assert(projectMemories.length > 0, "Test 447: Memory about FitPulse/fitness app exists");

  if (projectMemories.length > 0) {
    assert(
      projectMemories[0].category === "project",
      `Test 448: Memory categorized as "project" (got: "${projectMemories[0].category}")`
    );
    assert(
      projectMemories[0].text.toLowerCase().includes("fitpulse") ||
        projectMemories[0].text.toLowerCase().includes("fitness"),
      "Test 449: Memory text mentions FitPulse or fitness"
    );
  } else {
    assert(false, "Test 448: (skipped - no project memory found)");
    assert(false, "Test 449: (skipped - no project memory found)");
  }

  assert(
    memoriesAfterProject.length >= 2,
    `Test 450: At least 2 memories now exist (got: ${memoriesAfterProject.length})`
  );

  // --- TEST E4: Private mode message NOT saved to memory (Tests 454-462) ---
  console.log("\n--- TEST: Private mode message NOT saved to memory ---");

  const memoryCountBeforePrivate = (await getMemories()).length;

  const privateResponse = await sendChatAndWait(
    "My secret project is a dating app for cats",
    true
  );
  assert(privateResponse.length > 0, "Test 454: Got response to private message");

  await sleep(7000);

  const memoriesAfterPrivate = await getMemories();
  const catMemories = memoriesAfterPrivate.filter(
    (m: any) =>
      m.text.toLowerCase().includes("dating app") ||
      m.text.toLowerCase().includes("cat") ||
      m.text.toLowerCase().includes("secret project")
  );
  assert(
    catMemories.length === 0,
    "Test 455: No memory about dating app for cats was saved"
  );
  assert(
    memoriesAfterPrivate.length === memoryCountBeforePrivate,
    `Test 456: Memory count unchanged after private message (before: ${memoryCountBeforePrivate}, after: ${memoriesAfterPrivate.length})`
  );

  // --- Verify code-level private mode handling (Tests 457-460) ---
  console.log("\n--- TEST: Code-level private mode verification ---");

  const fs = require("fs");
  const path = require("path");

  const routesCode = fs.readFileSync(path.join(__dirname, "../server/routes.ts"), "utf-8");
  assert(
    routesCode.includes("!isPrivate") && routesCode.includes("extractAndSaveMemories"),
    "Test 457: Routes only extract memories when not private"
  );
  assert(
    routesCode.includes("isPrivate") && routesCode.includes("rememberFlag"),
    "Test 458: Routes check both isPrivate and rememberFlag"
  );

  const memoryCode = fs.readFileSync(path.join(__dirname, "../server/memory-engine.ts"), "utf-8");
  assert(
    memoryCode.includes("DO NOT STORE") &&
      (memoryCode.includes("greetings") || memoryCode.includes("casual")),
    "Test 459: Memory extraction prompt excludes greetings/casual remarks"
  );
  assert(
    memoryCode.includes("private") || memoryCode.includes("secret"),
    "Test 460: Memory extraction prompt excludes private/secret content"
  );

  // --- TEST F1: "What do you remember about me?" (Tests 461-468) ---
  console.log('\n--- TEST: "What do you remember about me?" ---');

  const recallResponse = await sendChatAndWait("What do you remember about me?");
  assert(recallResponse.length > 0, "Test 461: Got response to memory recall question");

  const recallLower = recallResponse.toLowerCase();
  assert(
    recallLower.includes("short") ||
      recallLower.includes("concise") ||
      recallLower.includes("brief") ||
      recallLower.includes("fluff") ||
      recallLower.includes("preference"),
    "Test 462: Recall mentions preference for short/concise answers"
  );
  assert(
    recallLower.includes("fitpulse") ||
      recallLower.includes("fitness") ||
      recallLower.includes("tracking"),
    "Test 463: Recall mentions FitPulse or fitness tracking app"
  );
  assert(
    !recallLower.includes("dating app for cats") &&
      !recallLower.includes("cat dating"),
    "Test 464: Recall does NOT mention private cat dating app"
  );

  // --- TEST F2: Memory API CRUD - Delete (Tests 469-475) ---
  console.log("\n--- TEST: Delete memory ---");

  const allMemories = await getMemories();
  assert(allMemories.length > 0, "Test 469: Memories exist to delete");

  if (allMemories.length > 0) {
    const memoryToDelete = allMemories[0];
    const deleteResp = await fetch(
      `${BASE_URL}/api/memories/${memoryToDelete.id}`,
      {
        method: "DELETE",
        headers: headers(),
      }
    );
    const deleteResult = (await deleteResp.json()) as any;
    assert(deleteResp.ok, "Test 470: Delete request succeeded");
    assert(deleteResult.success === true, "Test 471: Delete response indicates success");

    const memoriesAfterDelete = await getMemories();
    assert(
      memoriesAfterDelete.length === allMemories.length - 1,
      `Test 472: Memory count decreased by 1 (was ${allMemories.length}, now ${memoriesAfterDelete.length})`
    );
    assert(
      !memoriesAfterDelete.find((m: any) => m.id === memoryToDelete.id),
      "Test 473: Deleted memory no longer in list"
    );
  } else {
    assert(false, "Test 470: (skipped - no memories to delete)");
    assert(false, "Test 471: (skipped)");
    assert(false, "Test 472: (skipped)");
    assert(false, "Test 473: (skipped)");
  }

  // --- TEST F3: Delete all memories (Tests 474-476) ---
  console.log("\n--- TEST: Delete all memories ---");

  const clearResp = await fetch(`${BASE_URL}/api/memories`, {
    method: "DELETE",
    headers: headers(),
  });
  assert(clearResp.ok, "Test 474: Clear all memories request succeeded");

  const memoriesAfterClear = await getMemories();
  assert(
    memoriesAfterClear.length === 0,
    "Test 475: All memories cleared successfully"
  );

  // --- TEST F4: Memory UI code verification (Tests 476-480) ---
  console.log("\n--- TEST: Memory UI code verification ---");

  const memoryScreenCode = fs.readFileSync(
    path.join(__dirname, "../app/(tabs)/memory.tsx"),
    "utf-8"
  );

  assert(
    memoryScreenCode.includes("confirm") ||
      memoryScreenCode.includes("Alert.alert"),
    "Test 476: Memory delete shows confirmation dialog"
  );
  assert(
    memoryScreenCode.includes("trash-outline") ||
      memoryScreenCode.includes("delete"),
    "Test 477: Memory screen has delete button/icon"
  );
  assert(
    memoryScreenCode.includes("category") && memoryScreenCode.includes("categoryBadge"),
    "Test 478: Memory items display category badges"
  );
  assert(
    memoryScreenCode.includes("confidence") && memoryScreenCode.includes("confidenceChip"),
    "Test 479: Memory items display confidence chips"
  );

  const auraScreenCode = fs.readFileSync(
    path.join(__dirname, "../app/(tabs)/aura.tsx"),
    "utf-8"
  );
  assert(
    auraScreenCode.includes("isPrivate") && (auraScreenCode.includes("eye-off") || auraScreenCode.includes("lock")),
    "Test 480: Aura screen has private mode toggle with privacy icon"
  );

  // --- Summary ---
  console.log(`\n═══ Memory Saving & Usage Tests Complete ═══`);
  console.log(`Results: ${passCount} passed, ${failCount} failed out of ${passCount + failCount} tests\n`);
})();
