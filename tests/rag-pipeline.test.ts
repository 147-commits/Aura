/**
 * RAG Pipeline Tests — chunking, source quality scoring, and retrieval logic.
 * Pure unit tests — no DB or API calls.
 *
 * Run: npx tsx tests/rag-pipeline.test.ts
 */

import { chunkText } from "../server/embedding-engine";
import { scoreSourceQuality } from "../server/retrieval-engine";

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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 1: chunkText() — text splitting
// ═════════════════════════════════════════════════════════════════════════════

describe("chunkText() — basic behavior", () => {
  // Short text: single chunk
  {
    const chunks = chunkText("Hello world. This is a short text.");
    assert(chunks.length === 1, `Short text → 1 chunk (got ${chunks.length})`);
    assert(chunks[0] === "Hello world. This is a short text.", "Short text content preserved");
  }

  // Empty text
  {
    const chunks = chunkText("");
    assert(chunks.length === 0, "Empty text → 0 chunks");
  }

  // Whitespace only
  {
    const chunks = chunkText("   \n\n   ");
    assert(chunks.length === 0, "Whitespace → 0 chunks");
  }
});

describe("chunkText() — long text splitting", () => {
  // Long text should produce multiple chunks
  {
    const longText = Array(50).fill("This is a paragraph with enough content to make it meaningful. It discusses important topics and provides context.").join("\n\n");
    const chunks = chunkText(longText, 500, 50);
    assert(chunks.length > 1, `Long text → multiple chunks (got ${chunks.length})`);

    // Each chunk should be under max tokens
    for (let i = 0; i < chunks.length; i++) {
      const tokens = estimateTokens(chunks[i]);
      assert(tokens <= 600, `Chunk ${i}: ${tokens} tokens ≤ 600 (with overlap allowance)`);
    }
  }

  // Very long single paragraph: should split by sentences then words
  {
    const longParagraph = "This is a long sentence. ".repeat(200);
    const chunks = chunkText(longParagraph, 100, 20);
    assert(chunks.length > 1, `Long paragraph → multiple chunks (got ${chunks.length})`);
  }
});

describe("chunkText() — paragraph boundaries", () => {
  // Respects paragraph boundaries
  {
    const text = "Paragraph one content here.\n\nParagraph two content here.\n\nParagraph three content here.";
    const chunks = chunkText(text, 500, 50);
    assert(chunks.length >= 1, "Paragraphs → at least 1 chunk");
    assert(chunks[0].includes("Paragraph one"), "First paragraph included");
  }

  // Multiple paragraphs fit in one chunk
  {
    const text = "Short one.\n\nShort two.\n\nShort three.";
    const chunks = chunkText(text, 500, 50);
    assert(chunks.length === 1, "Short paragraphs → 1 chunk");
    assert(chunks[0].includes("Short one"), "All paragraphs in single chunk");
    assert(chunks[0].includes("Short three"), "Last paragraph included");
  }
});

describe("chunkText() — overlap verification", () => {
  // With enough text, chunks should have overlap
  {
    const sentences = Array(100).fill("The quick brown fox jumps over the lazy dog and runs across the field.").join(" ");
    const chunks = chunkText(sentences, 200, 50);

    if (chunks.length >= 2) {
      // Last 50 tokens (~200 chars) of chunk 0 should appear at start of chunk 1
      const endOfFirst = chunks[0].slice(-100);
      const startOfSecond = chunks[1].slice(0, 300);
      // At least some overlap should exist
      const words0 = endOfFirst.split(/\s+/);
      const overlapWords = words0.filter((w) => startOfSecond.includes(w));
      assert(overlapWords.length > 0, `Overlap exists between chunks (${overlapWords.length} shared words)`);
    } else {
      assert(true, "Text too short for overlap test — skipped");
    }
  }
});

describe("chunkText() — custom parameters", () => {
  const text = "Word ".repeat(1000);

  // Smaller max tokens → more chunks
  {
    const small = chunkText(text, 100, 20);
    const large = chunkText(text, 500, 50);
    assert(small.length > large.length, `Smaller maxTokens → more chunks (${small.length} > ${large.length})`);
  }

  // Zero overlap
  {
    const chunks = chunkText(text, 200, 0);
    assert(chunks.length > 1, "Zero overlap still produces chunks");
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 2: scoreSourceQuality() — source quality scoring
// ═════════════════════════════════════════════════════════════════════════════

describe("scoreSourceQuality() — base scores", () => {
  assert(scoreSourceQuality("academic") === 0.9, "academic → 0.9");
  assert(scoreSourceQuality("government") === 0.9, "government → 0.9");
  assert(scoreSourceQuality("documentation") === 0.8, "documentation → 0.8");
  assert(scoreSourceQuality("news") === 0.7, "news → 0.7");
  assert(scoreSourceQuality("blog") === 0.5, "blog → 0.5");
  assert(scoreSourceQuality("user_provided") === 0.4, "user_provided → 0.4");
  assert(scoreSourceQuality("unknown") === 0.3, "unknown type → 0.3 (default)");
});

describe("scoreSourceQuality() — URL bonuses", () => {
  // .edu bonus (use tolerance for floating point)
  assert(
    Math.abs(scoreSourceQuality("academic", "https://mit.edu/research") - 0.95) < 0.001,
    ".edu URL → +0.05 bonus (0.9 → 0.95)"
  );

  // .gov bonus
  assert(
    Math.abs(scoreSourceQuality("government", "https://data.gov/dataset") - 0.95) < 0.001,
    ".gov URL → +0.05 bonus (0.9 → 0.95)"
  );

  // .ac.uk bonus
  assert(
    Math.abs(scoreSourceQuality("academic", "https://ox.ac.uk/paper") - 0.95) < 0.001,
    ".ac.uk URL → +0.05 bonus"
  );

  // Cap at 1.0
  assert(
    scoreSourceQuality("academic", "https://harvard.edu/paper") <= 1.0,
    "Score capped at 1.0"
  );

  // No bonus for regular URLs
  assert(
    scoreSourceQuality("blog", "https://myblog.com") === 0.5,
    "Regular URL → no bonus"
  );

  // No URL → no bonus
  assert(
    scoreSourceQuality("news") === 0.7,
    "No URL → base score only"
  );

  // .edu on non-academic source
  assert(
    scoreSourceQuality("blog", "https://student.edu/blog") === 0.55,
    ".edu on blog → 0.5 + 0.05 = 0.55"
  );
});

describe("scoreSourceQuality() — ordering", () => {
  // Quality should be ordered: academic > documentation > news > blog > user_provided
  const scores = {
    academic: scoreSourceQuality("academic"),
    documentation: scoreSourceQuality("documentation"),
    news: scoreSourceQuality("news"),
    blog: scoreSourceQuality("blog"),
    user_provided: scoreSourceQuality("user_provided"),
  };

  assert(scores.academic > scores.documentation, "academic > documentation");
  assert(scores.documentation > scores.news, "documentation > news");
  assert(scores.news > scores.blog, "news > blog");
  assert(scores.blog > scores.user_provided, "blog > user_provided");

  // All scores between 0 and 1
  for (const [type, score] of Object.entries(scores)) {
    assert(score >= 0 && score <= 1, `${type} score ${score} in [0, 1]`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BLOCK 3: Integration sanity checks
// ═════════════════════════════════════════════════════════════════════════════

describe("Integration — chunking + quality scoring together", () => {
  // Simulate a document ingestion flow (without DB/API)
  {
    const document = "This is a research paper about machine learning.\n\n" +
      "Machine learning is a subset of artificial intelligence.\n\n" +
      "Deep learning uses neural networks with many layers.\n\n" +
      "Natural language processing enables computers to understand text.";

    const chunks = chunkText(document);
    const quality = scoreSourceQuality("academic", "https://arxiv.org/paper");

    assert(chunks.length >= 1, "Document produces chunks");
    assert(quality === 0.9, "Academic + .org URL → 0.9 (no .edu bonus for .org)");
  }

  // Verify quality is computed for each source type that templates might use
  {
    const templateKinds = [
      { type: "documentation", url: "https://docs.example.com" },
      { type: "blog", url: "https://blog.example.com" },
      { type: "news", url: "https://reuters.com/article" },
      { type: "academic", url: "https://nature.com/paper" },
      { type: "user_provided", url: undefined },
    ];

    for (const { type, url } of templateKinds) {
      const score = scoreSourceQuality(type, url);
      assert(score > 0 && score <= 1, `${type}: quality ${score} is valid`);
    }
  }
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`  RAG Pipeline: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);
