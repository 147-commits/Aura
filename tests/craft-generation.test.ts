/**
 * Craft Generation Tests — comprehensive validation of the Crafts pipeline.
 *
 * Tests: marker parsing, kind validation, buffer generation,
 * templates, route validation logic, and integration flow.
 *
 * Run: npx tsx tests/craft-generation.test.ts
 */

import { parseCraftRequest } from "../server/truth-engine";
import { getMimeType } from "../server/craft-engine";
import { getTemplates } from "../server/craft-templates";
import {
  generatePDF,
  generateDOCX,
  generatePPTX,
  generateXLSX,
  type DocumentRequest,
} from "../server/document-engine";
import type { CraftKind, CraftRequest } from "../shared/schema";

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

async function describeAsync(name: string, fn: () => Promise<void>) {
  console.log(`\n━━━ ${name} ━━━`);
  await fn();
}

// ─── Helper: basic DocumentRequest ──────────────────────────────────────────

const basicDocRequest: DocumentRequest = {
  type: "pdf",
  title: "Test Document",
  filename: "test.pdf",
  sections: [{ heading: "Introduction", content_markdown: "Hello world. This is a test document." }],
};

const VALID_KINDS: CraftKind[] = ["pdf", "docx", "pptx", "xlsx", "html", "react", "svg", "markdown", "code"];
const BINARY_KINDS = new Set(["pdf", "docx", "pptx", "xlsx"]);
const INLINE_KINDS = new Set(["html", "react", "svg", "markdown", "code"]);

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 1: parseCraftRequest() — marker parsing
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 1: parseCraftRequest() — marker parsing", () => {
  // No marker
  {
    const result = parseCraftRequest("Just a normal response with no markers.");
    assert(result.craftRequest === null, "No marker → craftRequest null");
    assert(result.cleanContent === "Just a normal response with no markers.", "No marker → content unchanged");
  }

  // Valid marker with valid JSON
  {
    const input = 'Here is your document.\n|||CRAFT_REQUEST|||{"kind":"docx","title":"My Report","sections":[]}';
    const result = parseCraftRequest(input);
    assert(result.craftRequest !== null, "Valid marker → craftRequest not null");
    assert(result.craftRequest?.kind === "docx", "Valid marker → kind is docx");
    assert(result.craftRequest?.title === "My Report", "Valid marker → title parsed");
    assert(result.cleanContent === "Here is your document.", "Valid marker → cleanContent before marker");
  }

  // Invalid JSON after marker
  {
    const input = "Some content.\n|||CRAFT_REQUEST|||{not valid json at all";
    const result = parseCraftRequest(input);
    assert(result.craftRequest === null, "Invalid JSON → null");
    assert(result.cleanContent === "Some content.", "Invalid JSON → cleanContent preserved");
  }

  // Missing kind field
  {
    const input = '|||CRAFT_REQUEST|||{"title":"Test"}';
    const result = parseCraftRequest(input);
    assert(result.craftRequest === null, "Missing kind → null");
  }

  // Missing title field
  {
    const input = '|||CRAFT_REQUEST|||{"kind":"pdf"}';
    const result = parseCraftRequest(input);
    assert(result.craftRequest === null, "Missing title → null");
  }

  // Invalid kind values
  {
    const invalids = ["invalid", "docxx", "PDF", "DOCX", "word", "excel", "powerpoint", ""];
    for (const kind of invalids) {
      const input = `|||CRAFT_REQUEST|||{"kind":"${kind}","title":"Test"}`;
      const result = parseCraftRequest(input);
      assert(result.craftRequest === null, `Invalid kind "${kind}" → null`);
    }
  }

  // All 9 valid kinds
  for (const kind of VALID_KINDS) {
    const input = `|||CRAFT_REQUEST|||{"kind":"${kind}","title":"Test ${kind}"}`;
    const result = parseCraftRequest(input);
    assert(result.craftRequest !== null, `Valid kind "${kind}" → parsed`);
    assert(result.craftRequest?.kind === kind, `Valid kind "${kind}" → correct kind value`);
  }

  // Content before marker preserved and trimmed
  {
    const input = '  Some content with spaces  \n|||CRAFT_REQUEST|||{"kind":"html","title":"Page"}';
    const result = parseCraftRequest(input);
    assert(result.cleanContent === "Some content with spaces", "Content trimmed");
  }

  // Empty content before marker
  {
    const input = '|||CRAFT_REQUEST|||{"kind":"code","title":"Script"}';
    const result = parseCraftRequest(input);
    assert(result.cleanContent === "", "Empty before marker → empty cleanContent");
  }

  // Very long content with marker at end
  {
    const longText = "word ".repeat(1000);
    const input = longText + '|||CRAFT_REQUEST|||{"kind":"markdown","title":"Notes"}';
    const result = parseCraftRequest(input);
    assert(result.craftRequest?.kind === "markdown", "Long content → still parses marker");
    assert(result.cleanContent.includes("word"), "Long content → preserved");
  }

  // Craft request with optional fields
  {
    const input = '|||CRAFT_REQUEST|||{"kind":"docx","title":"Report","sections":[{"heading":"Intro","content_markdown":"Hello"}],"tables":[{"title":"Data","columns":["A","B"],"rows":[["1","2"]]}]}';
    const result = parseCraftRequest(input);
    assert(result.craftRequest !== null, "With optional fields → parsed");
    assert(result.craftRequest?.sections?.length === 1, "Sections preserved");
    assert(result.craftRequest?.tables?.length === 1, "Tables preserved");
  }

  // Slides structure
  {
    const input = '|||CRAFT_REQUEST|||{"kind":"pptx","title":"Deck","slides":[{"master":"title","title":"Slide 1"}]}';
    const result = parseCraftRequest(input);
    assert(result.craftRequest?.slides?.length === 1, "Slides structure preserved");
    assert(result.craftRequest?.slides?.[0]?.master === "title", "Slide master preserved");
  }

  // Content field for inline crafts
  {
    const input = '|||CRAFT_REQUEST|||{"kind":"html","title":"Page","content":"<h1>Hello</h1>"}';
    const result = parseCraftRequest(input);
    assert(result.craftRequest?.content === "<h1>Hello</h1>", "Content field preserved for inline craft");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 2: getMimeType() and kind validation
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 2: getMimeType() — MIME type mapping", () => {
  const expected: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    html: "text/html",
    react: "text/plain",
    svg: "image/svg+xml",
    markdown: "text/markdown",
    code: "text/plain",
  };

  for (const [kind, mime] of Object.entries(expected)) {
    assert(
      getMimeType(kind as CraftKind) === mime,
      `getMimeType("${kind}") → "${mime}"`
    );
  }

  // Unknown kind fallback
  assert(
    getMimeType("unknown" as CraftKind) === "application/octet-stream",
    'getMimeType("unknown") → fallback to application/octet-stream'
  );

  // All valid kinds produce non-empty MIME types
  for (const kind of VALID_KINDS) {
    const mime = getMimeType(kind);
    assert(mime.length > 0, `getMimeType("${kind}") is non-empty`);
    assert(mime.includes("/"), `getMimeType("${kind}") contains "/" (valid MIME format)`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 3: Document generation — buffer output
// ═════════════════════════════════════════════════════════════════════════════

(async () => {

await describeAsync("BLOCK 3: generatePDF() — buffer generation", async () => {
  const buf = await generatePDF(basicDocRequest);
  assert(Buffer.isBuffer(buf), "generatePDF returns Buffer");
  assert(buf.length > 100, `generatePDF returns non-trivial buffer (${buf.length} bytes)`);
  assert(buf.slice(0, 4).toString() === "%PDF", "PDF starts with %PDF magic bytes");

  // With tables
  const withTables: DocumentRequest = {
    ...basicDocRequest,
    tables: [{ title: "Data", columns: ["Name", "Value"], rows: [["A", "1"], ["B", "2"]] }],
  };
  const buf2 = await generatePDF(withTables);
  assert(buf2.length > buf.length, "PDF with tables is larger");

  // With sources
  const withSources: DocumentRequest = {
    ...basicDocRequest,
    sources: [{ title: "Wikipedia", url: "https://en.wikipedia.org" }],
  };
  const buf3 = await generatePDF(withSources);
  assert(Buffer.isBuffer(buf3) && buf3.length > 100, "PDF with sources generates valid buffer");
});

await describeAsync("BLOCK 3: generateDOCX() — buffer generation", async () => {
  const docxRequest: DocumentRequest = { ...basicDocRequest, type: "docx", filename: "test.docx" };
  const buf = await generateDOCX(docxRequest);
  assert(Buffer.isBuffer(buf), "generateDOCX returns Buffer");
  assert(buf.length > 100, `generateDOCX returns non-trivial buffer (${buf.length} bytes)`);
  assert(buf[0] === 0x50 && buf[1] === 0x4B, "DOCX starts with PK zip header");

  // With tables
  const withTables: DocumentRequest = {
    ...docxRequest,
    tables: [{ title: "Metrics", columns: ["Metric", "Value"], rows: [["MRR", "$50k"], ["Churn", "3%"]] }],
  };
  const buf2 = await generateDOCX(withTables);
  assert(Buffer.isBuffer(buf2) && buf2.length > 100, "DOCX with tables generates valid buffer");

  // With sources
  const withSources: DocumentRequest = {
    ...docxRequest,
    sources: [{ title: "Aura Docs", url: "https://aura.ai" }],
  };
  const buf3 = await generateDOCX(withSources);
  assert(Buffer.isBuffer(buf3) && buf3.length > 100, "DOCX with sources generates valid buffer");

  // Multiple sections
  const multiSection: DocumentRequest = {
    ...docxRequest,
    sections: [
      { heading: "Overview", content_markdown: "This is the overview." },
      { heading: "Details", content_markdown: "→ Point one\n→ Point two\n→ Point three" },
      { heading: "Conclusion", content_markdown: "**Bold conclusion** with emphasis." },
    ],
  };
  const buf4 = await generateDOCX(multiSection);
  assert(Buffer.isBuffer(buf4) && buf4.length > buf.length, "DOCX with multiple sections is larger");
});

await describeAsync("BLOCK 3: generatePPTX() — buffer generation", async () => {
  // Sections fallback (no slides)
  const pptxFromSections: CraftRequest = {
    kind: "pptx",
    title: "Test Presentation",
    sections: [
      { heading: "Slide 1", content_markdown: "→ First point\n→ Second point" },
      { heading: "Slide 2", content_markdown: "More content here" },
    ],
  };
  const buf = await generatePPTX(pptxFromSections);
  assert(Buffer.isBuffer(buf), "generatePPTX (sections fallback) returns Buffer");
  assert(buf.length > 1000, `generatePPTX returns substantial buffer (${buf.length} bytes)`);
  assert(buf[0] === 0x50 && buf[1] === 0x4B, "PPTX starts with PK zip header");

  // Explicit slides
  const pptxWithSlides: CraftRequest = {
    kind: "pptx",
    title: "Pitch Deck",
    slides: [
      { master: "title", title: "My Startup", body: "Changing the world" },
      { master: "content", title: "Problem", bullets: ["Pain point 1", "Pain point 2"] },
      { master: "two-column", title: "Comparison", leftContent: "Option A", rightContent: "Option B" },
      { master: "closing", title: "Thank You" },
    ],
  };
  const buf2 = await generatePPTX(pptxWithSlides);
  assert(Buffer.isBuffer(buf2) && buf2.length > 1000, "PPTX with explicit slides generates valid buffer");

  // Empty sections/slides (no crash)
  const pptxEmpty: CraftRequest = { kind: "pptx", title: "Empty Deck" };
  const buf3 = await generatePPTX(pptxEmpty);
  assert(Buffer.isBuffer(buf3), "PPTX with no sections or slides doesn't crash");
});

await describeAsync("BLOCK 3: generateXLSX() — buffer generation", async () => {
  const xlsxRequest: CraftRequest = {
    kind: "xlsx",
    title: "Test Spreadsheet",
    sheets: [{
      name: "Data",
      columns: [{ header: "Name", key: "name" }, { header: "Value", key: "value" }],
      rows: [{ name: "Revenue", value: 50000 }, { name: "Costs", value: 30000 }],
    }],
  };
  const buf = await generateXLSX(xlsxRequest);
  assert(Buffer.isBuffer(buf), "generateXLSX returns Buffer");
  assert(buf.length > 1000, `generateXLSX returns substantial buffer (${buf.length} bytes)`);
  assert(buf[0] === 0x50 && buf[1] === 0x4B, "XLSX starts with PK zip header");

  // With formulas
  const withFormulas: CraftRequest = {
    kind: "xlsx",
    title: "Budget",
    sheets: [{
      name: "Budget",
      columns: [{ header: "Item", key: "item" }, { header: "Amount", key: "amount" }],
      rows: [{ item: "Rent", amount: 2000 }, { item: "Salary", amount: 5000 }],
      formulas: [{ cell: "B4", formula: "SUM(B2:B3)" }],
    }],
  };
  const buf2 = await generateXLSX(withFormulas);
  assert(Buffer.isBuffer(buf2) && buf2.length > 1000, "XLSX with formulas generates valid buffer");

  // Multiple sheets
  const multiSheet: CraftRequest = {
    kind: "xlsx",
    title: "Multi-sheet",
    sheets: [
      { name: "Sheet1", columns: [{ header: "A", key: "a" }], rows: [{ a: "data1" }] },
      { name: "Sheet2", columns: [{ header: "B", key: "b" }], rows: [{ b: "data2" }] },
    ],
  };
  const buf3 = await generateXLSX(multiSheet);
  assert(Buffer.isBuffer(buf3), "XLSX with multiple sheets generates valid buffer");

  // Fallback from sections (no sheets)
  const fromSections: CraftRequest = {
    kind: "xlsx",
    title: "From Sections",
    sections: [{ heading: "Overview", content_markdown: "Some content" }],
  };
  const buf4 = await generateXLSX(fromSections);
  assert(Buffer.isBuffer(buf4), "XLSX fallback from sections doesn't crash");
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 4: Craft templates
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 4: Craft templates", () => {
  const templates = getTemplates();

  assert(templates.length === 5, `getTemplates() returns exactly 5 (got ${templates.length})`);

  // All required fields present
  for (const t of templates) {
    assert(typeof t.id === "string" && t.id.length > 0, `Template "${t.id}": id is non-empty string`);
    assert(typeof t.name === "string" && t.name.length > 0, `Template "${t.id}": name is non-empty`);
    assert(typeof t.kind === "string" && t.kind.length > 0, `Template "${t.id}": kind is non-empty`);
    assert(typeof t.description === "string" && t.description.length > 0, `Template "${t.id}": description is non-empty`);
    assert(typeof t.prompt === "string" && t.prompt.length > 0, `Template "${t.id}": prompt is non-empty`);
    assert(typeof t.icon === "string" && t.icon.length > 0, `Template "${t.id}": icon is non-empty`);
  }

  // All kinds are valid CraftKind
  for (const t of templates) {
    assert(VALID_KINDS.includes(t.kind as CraftKind), `Template "${t.id}": kind "${t.kind}" is valid`);
  }

  // No duplicate IDs
  const ids = templates.map((t) => t.id);
  assert(ids.length === new Set(ids).size, "No duplicate template IDs");

  // Specific templates exist
  const idSet = new Set(ids);
  assert(idSet.has("resume"), "Resume template exists");
  assert(idSet.has("proposal"), "Proposal template exists");
  assert(idSet.has("pitch-deck"), "Pitch Deck template exists");
  assert(idSet.has("budget"), "Budget template exists");
  assert(idSet.has("landing-page"), "Landing Page template exists");

  // Correct kinds for specific templates
  const byId = Object.fromEntries(templates.map((t) => [t.id, t]));
  assert(byId["resume"].kind === "docx", "Resume is DOCX");
  assert(byId["proposal"].kind === "pdf", "Proposal is PDF");
  assert(byId["pitch-deck"].kind === "pptx", "Pitch Deck is PPTX");
  assert(byId["budget"].kind === "xlsx", "Budget is XLSX");
  assert(byId["landing-page"].kind === "html", "Landing Page is HTML");
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 5: Route validation logic (replicated locally)
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 5: Route validation logic", () => {
  function validateCraftRequest(req: Partial<CraftRequest>): string | null {
    if (!req.kind || !req.title) return "kind and title are required";
    if (!VALID_KINDS.includes(req.kind)) return "Invalid kind";
    if (["pdf", "docx"].includes(req.kind)) {
      if (!req.sections?.length) return "sections required for document crafts";
      if (req.sections.length > 20) return "Too many sections (max 20)";
      const totalLen = req.sections.reduce((s, sec) => s + (sec.content_markdown?.length || 0), 0);
      if (totalLen > 50000) return "Content too large (max 50k chars)";
    }
    if (req.kind === "pptx" && req.slides && req.slides.length > 30) return "Too many slides (max 30)";
    if (req.kind === "xlsx" && req.sheets && req.sheets.length > 10) return "Too many sheets (max 10)";
    if (["html", "react", "svg", "markdown", "code"].includes(req.kind)) {
      if (!req.content) return "content required for inline crafts";
      if (req.content.length > 100000) return "Content too large (max 100k chars)";
    }
    return null;
  }

  // Missing kind
  assert(validateCraftRequest({ title: "Test" }) !== null, "Missing kind → invalid");
  // Missing title
  assert(validateCraftRequest({ kind: "pdf" }) !== null, "Missing title → invalid");
  // Invalid kind
  assert(validateCraftRequest({ kind: "word" as any, title: "Test" }) !== null, "Invalid kind → invalid");

  // PDF without sections
  assert(validateCraftRequest({ kind: "pdf", title: "Test" }) !== null, "PDF without sections → invalid");
  // PDF with sections
  assert(validateCraftRequest({ kind: "pdf", title: "Test", sections: [{ heading: "H", content_markdown: "C" }] }) === null, "PDF with sections → valid");
  // Sections > 20
  assert(validateCraftRequest({ kind: "docx", title: "Test", sections: Array(21).fill({ heading: "H", content_markdown: "C" }) }) !== null, "21 sections → invalid");
  // Sections exactly 20
  assert(validateCraftRequest({ kind: "docx", title: "Test", sections: Array(20).fill({ heading: "H", content_markdown: "C" }) }) === null, "20 sections → valid");

  // Total content > 50k
  const bigSection = { heading: "H", content_markdown: "x".repeat(51000) };
  assert(validateCraftRequest({ kind: "pdf", title: "Test", sections: [bigSection] }) !== null, "50k+ chars → invalid");

  // PPTX > 30 slides
  assert(validateCraftRequest({ kind: "pptx", title: "Test", slides: Array(31).fill({ master: "content" as const }) }) !== null, "31 slides → invalid");
  // PPTX with 30 slides
  assert(validateCraftRequest({ kind: "pptx", title: "Test", slides: Array(30).fill({ master: "content" as const }) }) === null, "30 slides → valid");

  // XLSX > 10 sheets
  assert(validateCraftRequest({ kind: "xlsx", title: "Test", sheets: Array(11).fill({ name: "S", columns: [], rows: [] }) }) !== null, "11 sheets → invalid");

  // Inline without content
  assert(validateCraftRequest({ kind: "html", title: "Test" }) !== null, "HTML without content → invalid");
  assert(validateCraftRequest({ kind: "code", title: "Test" }) !== null, "Code without content → invalid");

  // Inline with content
  assert(validateCraftRequest({ kind: "html", title: "Test", content: "<h1>Hi</h1>" }) === null, "HTML with content → valid");

  // Inline content > 100k
  assert(validateCraftRequest({ kind: "html", title: "Test", content: "x".repeat(100001) }) !== null, "100k+ inline → invalid");

  // Valid minimal requests for each kind
  for (const kind of VALID_KINDS) {
    let req: Partial<CraftRequest>;
    if (kind === "pdf" || kind === "docx") {
      req = { kind, title: "Test", sections: [{ heading: "H", content_markdown: "C" }] };
    } else if (kind === "pptx") {
      req = { kind, title: "Test" }; // slides optional
    } else if (kind === "xlsx") {
      req = { kind, title: "Test" }; // sheets optional
    } else {
      req = { kind, title: "Test", content: "Hello" };
    }
    assert(validateCraftRequest(req) === null, `Valid minimal ${kind} request → passes`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 6: Integration — parse → route classification
// ═════════════════════════════════════════════════════════════════════════════

describe("BLOCK 6: Integration — parse → route classification", () => {
  // Binary kinds classified correctly
  for (const kind of ["pdf", "docx", "pptx", "xlsx"]) {
    const input = `|||CRAFT_REQUEST|||{"kind":"${kind}","title":"Test"}`;
    const result = parseCraftRequest(input);
    assert(result.craftRequest !== null, `${kind}: parsed`);
    assert(BINARY_KINDS.has(result.craftRequest!.kind), `${kind}: classified as binary`);
  }

  // Inline kinds classified correctly
  for (const kind of ["html", "react", "svg", "markdown", "code"]) {
    const input = `|||CRAFT_REQUEST|||{"kind":"${kind}","title":"Test","content":"data"}`;
    const result = parseCraftRequest(input);
    assert(result.craftRequest !== null, `${kind}: parsed`);
    assert(INLINE_KINDS.has(result.craftRequest!.kind), `${kind}: classified as inline`);
  }

  // Full simulated AI response: chat text + confidence + craft marker
  {
    const simulatedResponse =
      "Here's a budget tracker for your startup.\n\n" +
      "I've organized it by category with monthly columns.\n\n" +
      "Confidence: High (straightforward spreadsheet structure)\n" +
      '|||CRAFT_REQUEST|||{"kind":"xlsx","title":"Startup Budget","sheets":[{"name":"Budget","columns":[{"header":"Category","key":"cat"},{"header":"Amount","key":"amt"}],"rows":[{"cat":"Rent","amt":2000}]}]}';

    const result = parseCraftRequest(simulatedResponse);
    assert(result.craftRequest !== null, "Full response: craft parsed");
    assert(result.craftRequest?.kind === "xlsx", "Full response: kind is xlsx");
    assert(result.craftRequest?.sheets?.length === 1, "Full response: sheets preserved");
    assert(result.cleanContent.includes("budget tracker"), "Full response: chat text preserved");
    assert(result.cleanContent.includes("Confidence: High"), "Full response: confidence line in cleanContent");
  }

  // Simulated HTML craft response
  {
    const htmlResponse =
      "Here's your landing page!\n\n" +
      '|||CRAFT_REQUEST|||{"kind":"html","title":"Landing Page","content":"<div class=\\"hero\\"><h1>Welcome</h1></div>"}';
    const result = parseCraftRequest(htmlResponse);
    assert(result.craftRequest?.kind === "html", "HTML craft: kind correct");
    assert(result.craftRequest?.content?.includes("<h1>Welcome</h1>"), "HTML craft: content preserved with escaped quotes");
  }

  // Simulated PPTX craft response
  {
    const pptxResponse =
      "Here's your pitch deck.\n\n" +
      '|||CRAFT_REQUEST|||{"kind":"pptx","title":"Pitch Deck","slides":[{"master":"title","title":"My Startup"},{"master":"content","title":"Problem","bullets":["Pain 1","Pain 2"]},{"master":"closing","title":"Thanks"}]}';
    const result = parseCraftRequest(pptxResponse);
    assert(result.craftRequest?.kind === "pptx", "PPTX craft: kind correct");
    assert(result.craftRequest?.slides?.length === 3, "PPTX craft: 3 slides preserved");
    assert(result.craftRequest?.slides?.[1]?.bullets?.length === 2, "PPTX craft: bullets preserved");
  }

  // MIME type matches for each craft kind after parsing
  for (const kind of VALID_KINDS) {
    const input = `|||CRAFT_REQUEST|||{"kind":"${kind}","title":"Test"}`;
    const result = parseCraftRequest(input);
    if (result.craftRequest) {
      const mime = getMimeType(result.craftRequest.kind);
      assert(mime.includes("/"), `Parsed ${kind} → getMimeType returns valid MIME: ${mime}`);
    }
  }
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`  Craft Generation: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);

})();
