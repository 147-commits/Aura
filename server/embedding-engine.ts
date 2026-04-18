/**
 * Embedding Engine — text embedding and chunking for the RAG pipeline.
 *
 * Uses OpenAI text-embedding-3-small ($0.02/1M tokens — cheapest option).
 * Chunks documents into ~500 token pieces with 50 token overlap.
 * Stores embeddings in PostgreSQL via pgvector.
 */

import { getOpenAI } from "./ai-provider";
import { query } from "./db";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChunkMetadata {
  sourceUrl?: string;
  sourceTitle?: string;
  sourceType: "academic" | "government" | "news" | "documentation" | "blog" | "user_provided";
  qualityScore: number;
  parentDocumentId: string;
}

// ── Token Estimation ────────────────────────────────────────────────────────

/** Rough token estimate: 1 token ≈ 4 characters (consistent with model-router.ts) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Embedding ───────────────────────────────────────────────────────────────

/**
 * Embed a single text string using OpenAI text-embedding-3-small.
 * Returns a 1536-dimensional vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000), // API limit safety
  });
  return response.data[0].embedding;
}

/**
 * Embed a batch of texts (up to 2048 inputs).
 * Returns vectors in the same order as input.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const openai = getOpenAI();
  // Process in chunks of 2048 (API limit)
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += 2048) {
    const batch = texts.slice(i, i + 2048).map((t) => t.slice(0, 8000));
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    // Sort by index to preserve order
    const sorted = response.data.sort((a, b) => a.index - b.index);
    results.push(...sorted.map((d) => d.embedding));
  }
  return results;
}

// ── Chunking ────────────────────────────────────────────────────────────────

/**
 * Split text into chunks of approximately `maxTokens` tokens with `overlap` token overlap.
 * Uses recursive splitting: paragraphs → sentences → words.
 * Pure function — no async, no side effects.
 */
export function chunkText(
  text: string,
  maxTokens: number = 500,
  overlap: number = 50
): string[] {
  const maxChars = maxTokens * 4;
  const overlapChars = overlap * 4;

  if (estimateTokens(text) <= maxTokens) {
    return [text.trim()].filter(Boolean);
  }

  // Split by paragraphs first
  let segments = text.split(/\n\n+/);

  // If any paragraph is still too long, split by sentences
  const refined: string[] = [];
  for (const seg of segments) {
    if (estimateTokens(seg) <= maxTokens) {
      refined.push(seg);
    } else {
      // Split by sentence boundaries
      const sentences = seg.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (estimateTokens(sentence) <= maxTokens) {
          refined.push(sentence);
        } else {
          // Last resort: split by words
          const words = sentence.split(/\s+/);
          let current = "";
          for (const word of words) {
            if (estimateTokens(current + " " + word) > maxTokens && current) {
              refined.push(current.trim());
              current = word;
            } else {
              current = current ? current + " " + word : word;
            }
          }
          if (current.trim()) refined.push(current.trim());
        }
      }
    }
  }

  // Assemble chunks with overlap
  const chunks: string[] = [];
  let current = "";

  for (const segment of refined) {
    const combined = current ? current + "\n\n" + segment : segment;
    if (estimateTokens(combined) > maxTokens && current) {
      chunks.push(current.trim());
      // Start next chunk with overlap from the end of the previous
      const prevText = current;
      const overlapText = prevText.length > overlapChars
        ? prevText.slice(-overlapChars)
        : prevText;
      current = overlapText + "\n\n" + segment;
    } else {
      current = combined;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

// ── Chunk + Embed + Store ───────────────────────────────────────────────────

/**
 * Chunk a document, embed all chunks, and store in knowledge_chunks table.
 * Returns the number of chunks created.
 */
export async function chunkAndEmbed(
  document: string,
  metadata: ChunkMetadata
): Promise<number> {
  const chunks = chunkText(document);
  if (chunks.length === 0) return 0;

  const embeddings = await embedBatch(chunks);

  for (let i = 0; i < chunks.length; i++) {
    await query(
      `INSERT INTO knowledge_chunks
        (content, content_embedding, content_tsv, source_url, source_title,
         source_type, source_quality_score, chunk_index, parent_document_id, metadata)
       VALUES ($1, $2::vector, to_tsvector('english', $1), $3, $4, $5, $6, $7, $8, $9)`,
      [
        chunks[i],
        JSON.stringify(embeddings[i]),
        metadata.sourceUrl || null,
        metadata.sourceTitle || null,
        metadata.sourceType,
        metadata.qualityScore,
        i,
        metadata.parentDocumentId,
        JSON.stringify({}),
      ]
    );
  }

  return chunks.length;
}
