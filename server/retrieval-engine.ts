/**
 * Retrieval Engine — hybrid search combining vector similarity and full-text search.
 *
 * Uses pgvector for semantic search and PostgreSQL ts_vector for keyword matching.
 * Results merged via Reciprocal Rank Fusion for optimal relevance.
 */

import { embedText } from "./embedding-engine";
import { query, queryOne } from "./db";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RetrievalResult {
  id: string;
  content: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceType: string;
  qualityScore: number;
  relevanceScore: number;
  chunkIndex: number;
  parentDocumentId: string;
}

// ── Source Quality Scoring ──────────────────────────────────────────────────

/**
 * Score the quality/trustworthiness of a source.
 * Higher scores → more trustworthy → weighted higher in retrieval.
 */
export function scoreSourceQuality(sourceType: string, url?: string): number {
  let score: number;

  switch (sourceType) {
    case "academic":
    case "government":
      score = 0.9;
      break;
    case "documentation":
      score = 0.8;
      break;
    case "news":
      score = 0.7;
      break;
    case "blog":
      score = 0.5;
      break;
    case "user_provided":
      score = 0.4;
      break;
    default:
      score = 0.3;
  }

  // URL-based bonus for authoritative domains
  if (url) {
    const lower = url.toLowerCase();
    if (lower.includes(".edu") || lower.includes(".gov") || lower.includes(".ac.uk")) {
      score = Math.min(1.0, score + 0.05);
    }
  }

  return score;
}

// ── Hybrid Search ───────────────────────────────────────────────────────────

const RRF_K = 60; // Standard reciprocal rank fusion constant

/**
 * Hybrid search combining vector similarity and full-text search.
 * Returns results ranked by composite score (vector + FTS + source quality).
 */
export async function hybridSearch(
  queryText: string,
  topK: number = 5
): Promise<RetrievalResult[]> {
  // Early exit: check if knowledge base has any data
  const countResult = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text as count FROM knowledge_chunks"
  );
  if (!countResult || parseInt(countResult.count) === 0) {
    return [];
  }

  // Embed the query
  const queryEmbedding = await embedText(queryText);
  const candidateCount = topK * 2;

  // Layer 1: Vector similarity search
  let vectorResults: { id: string; content: string; source_url: string; source_title: string;
    source_type: string; source_quality_score: number; chunk_index: number;
    parent_document_id: string; vector_similarity: number }[] = [];

  try {
    vectorResults = await query(
      `SELECT id, content, source_url, source_title, source_type, source_quality_score,
              chunk_index, parent_document_id,
              1 - (content_embedding <=> $1::vector) AS vector_similarity
       FROM knowledge_chunks
       WHERE content_embedding IS NOT NULL
       ORDER BY content_embedding <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(queryEmbedding), candidateCount]
    );
  } catch (err) {
    console.warn("[retrieval] Vector search failed (pgvector may not be enabled):", (err as Error).message);
  }

  // Layer 2: Full-text search
  let ftsResults: { id: string; content: string; source_url: string; source_title: string;
    source_type: string; source_quality_score: number; chunk_index: number;
    parent_document_id: string; fts_rank: number }[] = [];

  try {
    ftsResults = await query(
      `SELECT id, content, source_url, source_title, source_type, source_quality_score,
              chunk_index, parent_document_id,
              ts_rank(content_tsv, plainto_tsquery('english', $1)) AS fts_rank
       FROM knowledge_chunks
       WHERE content_tsv @@ plainto_tsquery('english', $1)
       ORDER BY fts_rank DESC
       LIMIT $2`,
      [queryText, candidateCount]
    );
  } catch (err) {
    console.warn("[retrieval] FTS search failed:", (err as Error).message);
  }

  // If both searches returned nothing, return empty
  if (vectorResults.length === 0 && ftsResults.length === 0) {
    return [];
  }

  // Reciprocal Rank Fusion
  const MISSING_RANK = 1000;
  const scoreMap = new Map<string, {
    vectorRank: number;
    ftsRank: number;
    qualityScore: number;
    data: RetrievalResult;
  }>();

  // Assign vector ranks
  for (let i = 0; i < vectorResults.length; i++) {
    const r = vectorResults[i];
    scoreMap.set(r.id, {
      vectorRank: i + 1,
      ftsRank: MISSING_RANK,
      qualityScore: r.source_quality_score,
      data: {
        id: r.id,
        content: r.content,
        sourceUrl: r.source_url,
        sourceTitle: r.source_title,
        sourceType: r.source_type,
        qualityScore: r.source_quality_score,
        relevanceScore: 0, // computed below
        chunkIndex: r.chunk_index,
        parentDocumentId: r.parent_document_id,
      },
    });
  }

  // Assign FTS ranks (update existing or add new)
  for (let i = 0; i < ftsResults.length; i++) {
    const r = ftsResults[i];
    const existing = scoreMap.get(r.id);
    if (existing) {
      existing.ftsRank = i + 1;
    } else {
      scoreMap.set(r.id, {
        vectorRank: MISSING_RANK,
        ftsRank: i + 1,
        qualityScore: r.source_quality_score,
        data: {
          id: r.id,
          content: r.content,
          sourceUrl: r.source_url,
          sourceTitle: r.source_title,
          sourceType: r.source_type,
          qualityScore: r.source_quality_score,
          relevanceScore: 0,
          chunkIndex: r.chunk_index,
          parentDocumentId: r.parent_document_id,
        },
      });
    }
  }

  // Compute RRF scores
  const results: RetrievalResult[] = [];
  for (const entry of scoreMap.values()) {
    const rrfScore =
      0.6 / (RRF_K + entry.vectorRank) +
      0.3 / (RRF_K + entry.ftsRank) +
      0.1 * entry.qualityScore;

    entry.data.relevanceScore = rrfScore;
    results.push(entry.data);
  }

  // Sort by composite score descending, return top K
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return results.slice(0, topK);
}
