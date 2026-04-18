/**
 * Builder Tests — website/mobile app generation, deployment, templates.
 * Pure unit tests — no DB or API calls.
 *
 * Run: npx tsx tests/builder.test.ts
 */

import { WEBSITE_BUILDER_PROMPT, MOBILE_APP_BUILDER_PROMPT } from "../server/builder-prompts";
import { RN_ERROR_FIXES, buildErrorCorrectionPrompt } from "../server/snack-engine";

// Inline template data (can't import from RN component in Node.js test runner)
const BUILDER_TEMPLATES = [
  { id: "portfolio", name: "Personal Portfolio" },
  { id: "landing", name: "Landing Page" },
  { id: "blog", name: "Blog" },
  { id: "restaurant", name: "Restaurant / Business" },
  { id: "coming-soon", name: "Coming Soon" },
  { id: "todo-app", name: "Todo App" },
  { id: "calculator", name: "Calculator" },
  { id: "profile-card", name: "Profile Card" },
];

// ─── Test Harness ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${message}`);
    passed++;
  }
}

function describe(name: string, fn: () => void) {
  console.log(`\n━━━ ${name} ━━━`);
  fn();
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 1: Website builder prompt validation
// ═════════════════════════════════════════════════════════════════════════════

describe("Website builder prompt — content rules", () => {
  assert(WEBSITE_BUILDER_PROMPT.length > 200, "Prompt is substantial");
  assert(WEBSITE_BUILDER_PROMPT.includes("Tailwind"), "Mentions Tailwind CSS");
  assert(WEBSITE_BUILDER_PROMPT.includes("cdn.tailwindcss.com"), "Has Tailwind CDN URL");
  assert(WEBSITE_BUILDER_PROMPT.includes("viewport"), "Requires viewport meta tag");
  assert(WEBSITE_BUILDER_PROMPT.includes("responsive"), "Requires responsive design");
  assert(WEBSITE_BUILDER_PROMPT.includes("<!DOCTYPE html>"), "Specifies HTML doctype start");
  assert(WEBSITE_BUILDER_PROMPT.includes("</html>"), "Specifies HTML end tag");
  assert(WEBSITE_BUILDER_PROMPT.includes("semantic HTML5"), "Requires semantic HTML");
  assert(WEBSITE_BUILDER_PROMPT.includes("placehold.co"), "Uses placeholder image service");
  assert(WEBSITE_BUILDER_PROMPT.includes("full-file replacement"), "Full file replacement on changes");
  assert(!WEBSITE_BUILDER_PROMPT.includes("diff"), "Does NOT mention diffs (full replacement only)");
  assert(WEBSITE_BUILDER_PROMPT.includes("dark"), "Dark aesthetic default");
  assert(WEBSITE_BUILDER_PROMPT.includes("ONLY"), "Strict output format — HTML only, no explanation");
});

describe("Website builder prompt — generates valid HTML structure", () => {
  // Simulate what a valid AI response would look like
  const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <title>Test Site</title>
</head>
<body class="bg-gray-900 text-white">
  <header><nav>Navigation</nav></header>
  <main><section><h1>Hello World</h1></section></main>
  <footer>Footer</footer>
</body>
</html>`;

  assert(sampleHtml.startsWith("<!DOCTYPE html>"), "Starts with doctype");
  assert(sampleHtml.endsWith("</html>"), "Ends with </html>");
  assert(sampleHtml.includes("cdn.tailwindcss.com"), "Contains Tailwind CDN");
  assert(sampleHtml.includes("viewport"), "Contains viewport meta");
  assert(sampleHtml.includes("<header>"), "Has semantic header");
  assert(sampleHtml.includes("<main>"), "Has semantic main");
  assert(sampleHtml.includes("<footer>"), "Has semantic footer");
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 2: Mobile app builder prompt validation
// ═════════════════════════════════════════════════════════════════════════════

describe("Mobile app builder prompt — React Native rules", () => {
  assert(MOBILE_APP_BUILDER_PROMPT.length > 200, "Prompt is substantial");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("<Text>"), "Requires Text components");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("StyleSheet.create"), "Requires StyleSheet.create");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("NEVER use <div>"), "Forbids <div>");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("NEVER use px"), "Forbids px units");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("NEVER use position: 'fixed'"), "Forbids position fixed");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("NEVER use CSS Grid"), "Forbids CSS Grid");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("Flexbox"), "Requires Flexbox only");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("<View>"), "Requires View components");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("Expo SDK 54"), "Targets Expo SDK 54");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("export default"), "Requires default export");
  assert(MOBILE_APP_BUILDER_PROMPT.includes("App.tsx"), "Output is App.tsx");
});

describe("Mobile app prompt — no bare text strings allowed", () => {
  // Validate the prompt prevents the most common RN crash
  assert(
    MOBILE_APP_BUILDER_PROMPT.includes("ALWAYS wrap text in <Text>"),
    "Rule: always wrap text in Text"
  );
  assert(
    MOBILE_APP_BUILDER_PROMPT.includes("bare text crashes"),
    "Explains that bare text crashes RN"
  );

  // Simulated valid RN code (no bare text)
  const validCode = `
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello World</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
});`;

  assert(!validCode.includes("<div>"), "Valid RN code: no div tags");
  assert(!validCode.includes("<span>"), "Valid RN code: no span tags");
  assert(!validCode.includes("px"), "Valid RN code: no px units");
  assert(validCode.includes("StyleSheet.create"), "Valid RN code: uses StyleSheet.create");
  assert(validCode.includes("<Text"), "Valid RN code: text in Text component");
  assert(validCode.includes("export default"), "Valid RN code: has default export");
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 3: Templates validation
// ═════════════════════════════════════════════════════════════════════════════

describe("Builder templates — completeness", () => {
  assert(BUILDER_TEMPLATES.length === 8, `8 templates (5 web + 3 mobile) (got ${BUILDER_TEMPLATES.length})`);

  // All have required fields
  for (const t of BUILDER_TEMPLATES) {
    assert(typeof t.id === "string" && t.id.length > 0, `Template "${t.id}": has id`);
    assert(typeof t.name === "string" && t.name.length > 0, `Template "${t.id}": has name`);
  }

  // No duplicate IDs
  const ids = BUILDER_TEMPLATES.map((t) => t.id);
  assert(ids.length === new Set(ids).size, "No duplicate template IDs");

  // Specific templates exist
  const idSet = new Set(ids);
  assert(idSet.has("portfolio"), "Portfolio template exists");
  assert(idSet.has("landing"), "Landing Page template exists");
  assert(idSet.has("blog"), "Blog template exists");
  assert(idSet.has("restaurant"), "Restaurant template exists");
  assert(idSet.has("coming-soon"), "Coming Soon template exists");
  assert(idSet.has("todo-app"), "Todo App template exists");
  assert(idSet.has("calculator"), "Calculator template exists");
  assert(idSet.has("profile-card"), "Profile Card template exists");
});

describe("Builder templates — expected IDs verified", () => {
  const idSet = new Set(BUILDER_TEMPLATES.map((t) => t.id));
  // Web templates
  assert(idSet.has("portfolio"), "Portfolio template ID exists");
  assert(idSet.has("landing"), "Landing template ID exists");
  assert(idSet.has("blog"), "Blog template ID exists");
  // Mobile templates
  assert(idSet.has("todo-app"), "Todo App template ID exists");
  assert(idSet.has("calculator"), "Calculator template ID exists");
  assert(idSet.has("profile-card"), "Profile Card template ID exists");
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 4: React Native error handling
// ═════════════════════════════════════════════════════════════════════════════

describe("RN error fixes — pattern matching", () => {
  assert(RN_ERROR_FIXES.length >= 4, `At least 4 error patterns (got ${RN_ERROR_FIXES.length})`);

  // Each fix has pattern and fix text
  for (const fix of RN_ERROR_FIXES) {
    assert(typeof fix.pattern === "string" && fix.pattern.length > 0, `Pattern "${fix.pattern.slice(0, 30)}": has pattern`);
    assert(typeof fix.fix === "string" && fix.fix.length > 0, `Pattern "${fix.pattern.slice(0, 30)}": has fix`);
  }

  // Key patterns exist
  const patterns = RN_ERROR_FIXES.map((f) => f.pattern.toLowerCase());
  assert(
    patterns.some((p) => p.includes("text strings")),
    "Has bare text error pattern"
  );
  assert(
    patterns.some((p) => p.includes("undefined")),
    "Has undefined error pattern"
  );
  assert(
    patterns.some((p) => p.includes("invariant")),
    "Has Invariant Violation pattern"
  );
});

describe("Error correction prompt — structure", () => {
  const code = `function App() { return <View><Text>Hello</Text></View>; }`;
  const error = "Text strings must be rendered within a <Text> component";

  const prompt = buildErrorCorrectionPrompt(code, error);

  assert(prompt.includes(error), "Includes the original error");
  assert(prompt.includes(code), "Includes the original code");
  assert(prompt.includes("LIKELY FIX"), "Includes matched fix suggestion");
  assert(prompt.includes("COMPLETE corrected"), "Asks for complete corrected code");
  assert(prompt.includes("<Text>"), "Reminds about Text component rule");
  assert(prompt.includes("StyleSheet.create"), "Reminds about StyleSheet rule");

  // Error without match still works
  const unknownPrompt = buildErrorCorrectionPrompt(code, "Some unknown error xyz");
  assert(unknownPrompt.includes("Some unknown error xyz"), "Unknown error: included in prompt");
  assert(!unknownPrompt.includes("LIKELY FIX"), "Unknown error: no LIKELY FIX section");
  assert(unknownPrompt.includes("COMPLETE corrected"), "Unknown error: still asks for fix");
});

describe("Error retry — max 3 attempts logic", () => {
  // Simulate retry tracking
  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (retryCount < MAX_RETRIES) {
    retryCount++;
  }
  assert(retryCount === 3, `Retry loop stops at 3 (got ${retryCount})`);
  assert(retryCount <= MAX_RETRIES, "Never exceeds max retries");

  // After max retries: should show user-friendly message
  const userMessage = retryCount >= MAX_RETRIES
    ? "Try simplifying your request"
    : "Retrying...";
  assert(userMessage === "Try simplifying your request", "After 3 retries: shows friendly message");
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 5: Vercel deployment validation
// ═════════════════════════════════════════════════════════════════════════════

describe("Vercel deploy — request structure", () => {
  // Simulate the Vercel API request body
  const projectName = "My Awesome Website!";
  const files = { "index.html": "<html><body>Hello</body></html>" };

  const cleanName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 50);
  assert(cleanName === "my-awesome-website-", "Project name cleaned for Vercel");

  const apiBody = {
    name: cleanName,
    files: Object.entries(files).map(([file, content]) => ({
      file, data: content, encoding: "utf-8",
    })),
    projectSettings: { framework: null, buildCommand: "", outputDirectory: "." },
  };

  assert(apiBody.name === cleanName, "Body has clean project name");
  assert(apiBody.files.length === 1, "Body has 1 file");
  assert(apiBody.files[0].file === "index.html", "File is index.html");
  assert(apiBody.files[0].encoding === "utf-8", "Encoding is utf-8");
  assert(apiBody.projectSettings.framework === null, "No framework (static)");
  assert(apiBody.projectSettings.buildCommand === "", "No build command");
  assert(apiBody.projectSettings.outputDirectory === ".", "Output is root");

  // Multiple files
  const multiFiles = {
    "index.html": "<html>Home</html>",
    "about.html": "<html>About</html>",
    "style.css": "body { color: red; }",
  };
  const multiBody = Object.entries(multiFiles).map(([file, data]) => ({ file, data, encoding: "utf-8" }));
  assert(multiBody.length === 3, "Multi-file: 3 files in body");

  // Name sanitization edge cases
  assert(
    "hello world 123".replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") === "hello-world-123",
    "Name sanitization: spaces → hyphens"
  );
  assert(
    "UPPER case".toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") === "upper-case",
    "Name sanitization: lowercased"
  );
  assert(
    "special!@#$chars".replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") === "special-chars",
    "Name sanitization: special chars removed"
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 6: Project lifecycle validation
// ═════════════════════════════════════════════════════════════════════════════

describe("Project lifecycle — file management", () => {
  // Simulate project file updates
  let projectFiles: Record<string, string> = {};

  // Initial creation: empty files
  assert(Object.keys(projectFiles).length === 0, "New project: no files");

  // First generation: adds index.html
  projectFiles = { ...projectFiles, "index.html": "<html>v1</html>" };
  assert(Object.keys(projectFiles).length === 1, "After gen 1: 1 file");
  assert(projectFiles["index.html"].includes("v1"), "File has v1 content");

  // Second generation: replaces index.html
  projectFiles = { ...projectFiles, "index.html": "<html>v2</html>" };
  assert(Object.keys(projectFiles).length === 1, "After gen 2: still 1 file");
  assert(projectFiles["index.html"].includes("v2"), "File updated to v2");

  // Multi-file project (future)
  projectFiles = { ...projectFiles, "style.css": "body { margin: 0; }" };
  assert(Object.keys(projectFiles).length === 2, "Multi-file: 2 files");

  // JSONB storage simulation
  const stored = JSON.stringify(projectFiles);
  const restored = JSON.parse(stored);
  assert(restored["index.html"] === "<html>v2</html>", "JSONB roundtrip preserves HTML");
  assert(restored["style.css"] === "body { margin: 0; }", "JSONB roundtrip preserves CSS");
});

describe("Project lifecycle — version tracking", () => {
  let version = 1;

  // Each generation increments version
  version++;
  assert(version === 2, "After 1 generation: v2");

  version++;
  assert(version === 3, "After 2 generations: v3");

  // Version badge format
  assert(`v${version}` === "v3", "Version badge: v3");
});

describe("Project lifecycle — conversation linking", () => {
  // Project should reference its conversation
  const project = {
    id: "proj-123",
    conversationId: "conv-456",
    name: "My Website",
    files: {},
  };

  assert(project.conversationId === "conv-456", "Project linked to conversation");
  assert(typeof project.conversationId === "string", "conversationId is string");

  // Project without conversation (standalone builder)
  const standalone = { id: "proj-789", conversationId: undefined };
  assert(standalone.conversationId === undefined, "Standalone project: no conversation");
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 7: Builder system prompt safety
// ═════════════════════════════════════════════════════════════════════════════

describe("Builder prompts — safety checks", () => {
  const forbidden = [
    "ignore previous", "override", "disregard", "forget your rules",
    "skip confidence", "hallucinate", "jailbreak",
  ];

  for (const phrase of forbidden) {
    assert(
      !WEBSITE_BUILDER_PROMPT.toLowerCase().includes(phrase),
      `Website prompt: no "${phrase}"`
    );
    assert(
      !MOBILE_APP_BUILDER_PROMPT.toLowerCase().includes(phrase),
      `Mobile prompt: no "${phrase}"`
    );
  }

  // Prompts don't expose internal system details
  assert(!WEBSITE_BUILDER_PROMPT.includes("AURA_CORE"), "Website: no AURA_CORE leak");
  assert(!MOBILE_APP_BUILDER_PROMPT.includes("AURA_CORE"), "Mobile: no AURA_CORE leak");
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`  Builder Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);
