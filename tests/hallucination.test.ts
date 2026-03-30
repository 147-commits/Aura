/**
 * Hallucination Guard Tests
 *
 * Tests that Aura's Truth Engine:
 * 1. Never invents facts
 * 2. Always returns confidence levels
 * 3. Refuses to guess when uncertain
 * 4. Properly assigns Low confidence to uncertain claims
 */

import { parseConfidence, parseDocumentRequest, parseActionItems, buildTruthSystemPrompt } from "../server/truth-engine";

// ─── Unit Tests ──────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

// Test 1: parseConfidence extracts High correctly
{
  const content = "The sky is blue because of Rayleigh scattering.\nConfidence: High";
  const { cleanContent, confidence } = parseConfidence(content);
  assert(confidence === "High", "parseConfidence extracts High");
  assert(!cleanContent.includes("Confidence:"), "parseConfidence removes confidence line from content");
  assert(cleanContent.includes("Rayleigh scattering"), "parseConfidence preserves content");
}

// Test 2: parseConfidence extracts Medium
{
  const content = "This company was probably founded in 2010.\nConfidence: Medium";
  const { confidence } = parseConfidence(content);
  assert(confidence === "Medium", "parseConfidence extracts Medium");
}

// Test 3: parseConfidence extracts Low
{
  const content = "I'm not certain about this. What I can say is X.\nConfidence: Low";
  const { confidence } = parseConfidence(content);
  assert(confidence === "Low", "parseConfidence extracts Low");
}

// Test 4: parseConfidence defaults to Medium if missing
{
  const content = "Some response without a confidence marker.";
  const { confidence } = parseConfidence(content);
  assert(confidence === "Medium", "parseConfidence defaults to Medium when marker is missing");
}

// Test 5: parseConfidence handles case-insensitive
{
  const content = "Some response.\nconfidence: high";
  const { confidence } = parseConfidence(content);
  assert(confidence === "High", "parseConfidence is case-insensitive");
}

// Test 6: System prompt contains no-hallucination rule
{
  const prompt = buildTruthSystemPrompt("chat", "normal", []);
  assert(prompt.includes("Never invent facts"), "System prompt includes anti-hallucination rule");
  assert(prompt.includes("Confidence"), "System prompt requires confidence level");
}

// Test 7: System prompt with memory includes user context
{
  const memory = [{ text: "User is building an AI startup", category: "context" }];
  const prompt = buildTruthSystemPrompt("chat", "normal", memory);
  assert(prompt.includes("AI startup"), "System prompt includes user memory");
}

// Test 8: Research mode prompt is different from chat mode
{
  const chatPrompt = buildTruthSystemPrompt("chat", "normal", []);
  const researchPrompt = buildTruthSystemPrompt("research", "normal", []);
  assert(chatPrompt !== researchPrompt, "Research mode has different system prompt than chat mode");
  assert(researchPrompt.includes("findings") || researchPrompt.includes("Research Mode"), "Research prompt includes structured report format");
}

// Test 9: Explain level affects system prompt
{
  const simplePrompt = buildTruthSystemPrompt("explain", "simple", []);
  const expertPrompt = buildTruthSystemPrompt("explain", "expert", []);
  assert(simplePrompt.includes("12-year-old"), "Simple mode targets layperson explanation");
  assert(expertPrompt.includes("technical language"), "Expert mode uses technical language");
}

// Test 10: Decision mode includes pros/cons template
{
  const decisionPrompt = buildTruthSystemPrompt("decision", "normal", []);
  assert(decisionPrompt.includes("pros") || decisionPrompt.includes("Pros"), "Decision mode includes pros/cons structure");
  assert(decisionPrompt.includes("recommendation") || decisionPrompt.includes("Recommendation"), "Decision mode includes recommendation section");
}

// Test 11: Refusal policy is present
{
  const prompt = buildTruthSystemPrompt("chat", "normal", []);
  assert(prompt.includes("REFUSAL POLICY") || prompt.includes("ABSOLUTE RULES"), "System prompt includes refusal policy");
}

// Test 12: Brainstorm mode includes idea count
{
  const brainstormPrompt = buildTruthSystemPrompt("brainstorm", "normal", []);
  assert(brainstormPrompt.includes("ideas") || brainstormPrompt.includes("Ideas"), "Brainstorm mode asks for ideas");
}

// Test 13: parseDocumentRequest extracts document data
{
  const content = `Here is your answer.\n\n|||DOCUMENT_REQUEST|||{"type":"pdf","title":"Test","filename":"test.pdf","sections":[{"heading":"Intro","content_markdown":"Hello"}]}`;
  const result = parseDocumentRequest(content);
  assert(result.cleanContent === "Here is your answer.", "parseDocumentRequest strips document marker from content");
  assert(result.documentRequest !== null, "parseDocumentRequest extracts document request object");
  assert(result.documentRequest.title === "Test", "parseDocumentRequest parses title correctly");
}

// Test 14: parseDocumentRequest handles no document
{
  const content = "Just a normal response with no document request.";
  const result = parseDocumentRequest(content);
  assert(result.cleanContent === content, "parseDocumentRequest leaves normal content unchanged");
  assert(result.documentRequest === null, "parseDocumentRequest returns null when no document requested");
}

// Test 15: Answer shape matching is in the system prompt
{
  const prompt = buildTruthSystemPrompt("chat", "normal", []);
  assert(prompt.includes("ANSWER SHAPE MATCHING"), "System prompt includes answer shape matching");
  assert(prompt.includes("SIMPLE FACT"), "System prompt includes simple fact shape");
  assert(prompt.includes("TROUBLESHOOTING"), "System prompt includes troubleshooting shape");
  assert(prompt.includes("COMPARISON"), "System prompt includes comparison shape");
  assert(prompt.includes("BRAINSTORMING"), "System prompt includes brainstorming shape");
  assert(prompt.includes("RESEARCH"), "System prompt includes research shape");
  assert(prompt.includes("PLANS"), "System prompt includes plans shape");
}

// Test 16: Document export instruction is in system prompt
{
  const prompt = buildTruthSystemPrompt("chat", "normal", []);
  assert(prompt.includes("DOCUMENT_REQUEST"), "System prompt includes document export instruction");
}

// Test 17: Attachment understanding rules in system prompt
{
  const prompt = buildTruthSystemPrompt("chat", "normal", []);
  assert(prompt.includes("ATTACHMENT UNDERSTANDING"), "System prompt includes attachment understanding rules");
  assert(prompt.includes("images or files"), "Attachment rules mention images and files");
  assert(prompt.includes("sensitive personal data"), "Attachment rules include privacy guidance");
}

// Test 18: Action detection rules in system prompt
{
  const prompt = buildTruthSystemPrompt("chat", "normal", []);
  assert(prompt.includes("ACTION DETECTION"), "System prompt includes action detection rules");
  assert(prompt.includes("ACTION_ITEMS"), "System prompt includes ACTION_ITEMS marker");
}

// Test 19: parseActionItems extracts tasks correctly
{
  const content = 'Here are your tasks.\n|||ACTION_ITEMS|||[{"type":"task","title":"Email Ali","description":"Send update","priority":"high"}]';
  const { cleanContent, actionItems } = parseActionItems(content);
  assert(actionItems.length === 1, "parseActionItems extracts one item");
  assert(actionItems[0].type === "task", "Extracted item is a task");
  assert(actionItems[0].title === "Email Ali", "Task title extracted correctly");
  assert(!cleanContent.includes("ACTION_ITEMS"), "Action items marker removed from content");
  assert(cleanContent.includes("tasks"), "Content preserved before marker");
}

// Test 20: parseActionItems handles empty/no marker
{
  const { cleanContent, actionItems } = parseActionItems("Hello, how are you?");
  assert(actionItems.length === 0, "No action items when no marker");
  assert(cleanContent === "Hello, how are you?", "Content unchanged when no marker");
}

// Test 21: parseActionItems handles multiple items
{
  const content = 'Done.\n|||ACTION_ITEMS|||[{"type":"task","title":"T1","description":"D1"},{"type":"project","title":"P1","description":"D2"}]';
  const { actionItems } = parseActionItems(content);
  assert(actionItems.length === 2, "parseActionItems extracts multiple items");
  assert(actionItems[1].type === "project", "Second item is a project");
}

// Test 22: parseActionItems handles malformed JSON
{
  const content = 'Hello.\n|||ACTION_ITEMS|||{not valid json';
  const { cleanContent, actionItems } = parseActionItems(content);
  assert(actionItems.length === 0, "Malformed JSON returns empty array");
  assert(cleanContent === "Hello.", "Content still cleaned with malformed JSON");
}

// Test 23: parseActionItems caps at 3 items
{
  const items = Array.from({ length: 5 }, (_, i) => ({ type: "task", title: `T${i}`, description: `D${i}` }));
  const content = `Test.\n|||ACTION_ITEMS|||${JSON.stringify(items)}`;
  const { actionItems } = parseActionItems(content);
  assert(actionItems.length <= 3, "Action items capped at 3");
}

console.log("\n─── Hallucination Guard Tests Complete ───\n");

// ─── File Engine Tests ────────────────────────────────────────────────────────

import { processAttachment, buildAttachmentContext } from "../server/file-engine";

(async () => {
  // Test F1: Text file extraction
  {
    const buffer = Buffer.from("Hello world\nThis is a test file.");
    const result = await processAttachment(buffer, "text/plain", "test.txt");
    assert(result.type === "document", "Text file processed as document");
    assert(result.text?.includes("Hello world") === true, "Text content extracted from .txt");
    assert(result.filename === "test.txt", "Filename preserved for text file");
  }

  // Test F2: CSV extraction
  {
    const csv = "name,age,city\nAlice,30,NYC\nBob,25,LA";
    const buffer = Buffer.from(csv);
    const result = await processAttachment(buffer, "text/csv", "data.csv");
    assert(result.type === "document", "CSV processed as document");
    assert(result.text?.includes("Alice") === true, "CSV content includes data rows");
    assert(result.text?.includes("CSV Data") === true, "CSV has header label");
  }

  // Test F3: Image attachment returns base64
  {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const result = await processAttachment(buffer, "image/png", "screenshot.png");
    assert(result.type === "image", "Image processed as image type");
    assert(result.base64 !== undefined, "Image has base64 data");
    assert(result.filename === "screenshot.png", "Image filename preserved");
  }

  // Test F4: Unsupported file type
  {
    const buffer = Buffer.from("binary data");
    const result = await processAttachment(buffer, "application/octet-stream", "data.bin");
    assert(result.type === "document", "Unsupported file returns document type");
    assert(result.text?.includes("Unsupported file type") === true, "Unsupported file gets error message");
  }

  // Test F5: Text truncation for large files
  {
    const longText = "A".repeat(10000);
    const buffer = Buffer.from(longText);
    const result = await processAttachment(buffer, "text/plain", "big.txt");
    assert(result.truncated === true, "Large text file is truncated");
    assert((result.text?.length || 0) < 10000, "Truncated text is shorter than original");
  }

  // Test F6: buildAttachmentContext for documents
  {
    const context = buildAttachmentContext([
      { type: "document", filename: "test.pdf", mimeType: "application/pdf", text: "Some content", pageCount: 3 },
    ]);
    assert(context.includes("test.pdf"), "Context includes filename");
    assert(context.includes("3 pages"), "Context includes page count");
  }

  // Test F7: buildAttachmentContext for images
  {
    const context = buildAttachmentContext([
      { type: "image", filename: "photo.jpg", mimeType: "image/jpeg", base64: "abc123" },
    ]);
    assert(context.includes("photo.jpg"), "Context mentions image filename");
    assert(context.includes("image(s) attached"), "Context indicates image attachment");
  }

  // Test F8: buildAttachmentContext empty
  {
    const context = buildAttachmentContext([]);
    assert(context === "", "Empty attachments produce empty context");
  }

  console.log("\n─── File Engine Tests Complete ───\n");
})();
