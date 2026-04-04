import OpenAI from "openai";
import { hybridSearch } from "./retrieval-engine";

export interface Citation {
  url: string;
  title: string;
  snippet: string;
}

export interface ResearchResult {
  content: string;
  citations: Citation[];
  confidence: "High" | "Medium" | "Low";
}

export async function runResearch(
  query: string,
  openai: OpenAI,
  memory: { text: string; category: string }[] = []
): Promise<ResearchResult> {
  const memoryContext = memory.length > 0
    ? `\n\nUser context: ${memory.map((m) => m.text).join("; ")}`
    : "";

  // RAG: check local knowledge base first
  let ragContext = "";
  let ragCitations: Citation[] = [];
  try {
    const ragResults = await hybridSearch(query, 5);
    if (ragResults.length > 0) {
      ragContext = `\n\nRelevant knowledge base context:\n${ragResults.map((r) =>
        `[Source: ${r.sourceTitle || r.sourceUrl || "Knowledge Base"} (${r.sourceType}, quality: ${r.qualityScore.toFixed(1)})]:\n${r.content}`
      ).join("\n\n")}`;
      ragCitations = ragResults
        .filter((r) => r.sourceUrl)
        .map((r) => ({ url: r.sourceUrl!, title: r.sourceTitle || "Knowledge Base", snippet: r.content.slice(0, 200) }));
    }
  } catch (ragErr) {
    console.warn("[research] RAG search failed, continuing with web search:", ragErr);
  }

  try {
    const response = await (openai as any).responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview" }],
      input: `${query}${memoryContext}${ragContext}

Respond with a structured research report. Include:
## Summary
[2-3 sentence executive summary]

## Key Findings
- [Finding with source]

## What's Verified
[High-confidence facts]

## What's Likely
[Medium-confidence inferences]

## What Would Confirm It
[What additional info would resolve uncertainty]

End with: Confidence: High|Medium|Low`,
    });

    const outputText = response.output_text || "";
    const annotations: any[] = response.output?.[0]?.content?.[0]?.annotations || [];

    const citations: Citation[] = annotations
      .filter((a: any) => a.type === "url_citation")
      .map((a: any) => ({
        url: a.url || "",
        title: a.title || a.url || "Source",
        snippet: a.quoted_text?.slice(0, 200) || "",
      }))
      .filter((c: Citation) => c.url);

    const confidenceMatch = outputText.match(/Confidence:\s*(High|Medium|Low)/i);
    const confidence = (confidenceMatch?.[1] as "High" | "Medium" | "Low") ?? "Medium";
    const cleanContent = outputText.replace(/Confidence:\s*(High|Medium|Low)\s*$/im, "").trim();

    // Merge RAG + web citations (deduplicate by URL)
    const seenUrls = new Set(citations.map((c) => c.url));
    const mergedCitations = [...citations, ...ragCitations.filter((c) => !seenUrls.has(c.url))];

    return { content: cleanContent, citations: mergedCitations, confidence };
  } catch (err) {
    console.error("Research engine error, falling back:", err);
    return await fallbackResearch(query, openai, memoryContext, ragContext);
  }
}

async function fallbackResearch(
  query: string,
  openai: OpenAI,
  memoryContext: string,
  ragContext: string = ""
): Promise<ResearchResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a rigorous research assistant. Be honest about what you know vs what is uncertain.
IMPORTANT: You do not have live web access in this fallback mode. State this clearly when relevant.${ragContext ? "\nHowever, you have access to a local knowledge base with relevant context — use it when applicable." : ""}
Always end with: Confidence: High|Medium|Low`,
      },
      {
        role: "user",
        content: `Research query: ${query}${memoryContext}${ragContext}

Provide a structured research report. Note: I'm working from training data only, not live web search.

## Summary
[Executive summary]

## Key Findings
[What I know with high confidence]

## Limitations
[What I cannot verify without live search]

## What Would Confirm It
[Sources or searches that would help]

Confidence: High|Medium|Low`,
      },
    ],
    max_completion_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content || "";
  const confidenceMatch = content.match(/Confidence:\s*(High|Medium|Low)/i);
  const confidence = (confidenceMatch?.[1] as "High" | "Medium" | "Low") ?? "Low";
  const cleanContent = content.replace(/Confidence:\s*(High|Medium|Low)\s*$/im, "").trim();

  return { content: cleanContent, citations: [], confidence };
}
