/**
 * AI Provider — public façade over the provider registry.
 *
 * Thin shim that delegates to ./providers/* so the rest of the server
 * (routes, embedding-engine, memory-consolidator, etc.) keeps its existing
 * import surface unchanged while the underlying provider stack is portable
 * to any host.
 *
 * Strategy:
 *   - Claude / "skill" tier  → Anthropic when ANTHROPIC_API_KEY is present
 *   - GPT-4o / "standard"    → OpenAI
 *   - GPT-4o-mini / "mini"   → OpenAI
 *
 * See server/providers/provider-registry.ts for routing.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import { selectProvider, getOpenAIProviderInstance } from "./providers/provider-registry";
import type { ChatMessage as ProviderChatMessage } from "./providers/ai-provider-interface";

// ── Public Types (re-exported / stable) ──────────────────────────────────────

export type Provider = "openai" | "anthropic";

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface StreamChunk {
  content: string;
}

export interface CompletionOptions {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  stream: true;
}

export interface NonStreamingOptions {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
}

// ── Model Registry ──────────────────────────────────────────────────────────

export const PROVIDER_MODELS = {
  /** Claude Sonnet — skill responses, structured reasoning */
  "claude-sonnet": { provider: "anthropic" as Provider, model: "claude-sonnet-4-20250514", maxTokens: 4096 },
  /** GPT-4o — research, complex non-skill queries */
  "gpt-4o": { provider: "openai" as Provider, model: "gpt-4o", maxTokens: 4096 },
  /** GPT-4o-mini — routing, background, cheap tasks */
  "gpt-4o-mini": { provider: "openai" as Provider, model: "gpt-4o-mini", maxTokens: 4096 },
} as const;

export type ModelId = keyof typeof PROVIDER_MODELS;

// ── SDK Accessors (back-compat) ─────────────────────────────────────────────

/**
 * Return the underlying OpenAI SDK client.
 *
 * Used by callers that need OpenAI-specific features (Responses API with
 * web_search_preview, embeddings, image edits, etc.) and can't go through
 * the provider-neutral interface.
 */
export function getOpenAI(): OpenAI {
  return getOpenAIProviderInstance().raw();
}

/**
 * Return the underlying Anthropic SDK client.
 * Throws if ANTHROPIC_API_KEY is not set — callers should be tier-routed.
 */
export function getAnthropic(): Anthropic {
  const provider = selectProvider("skill");
  if (provider.id !== "anthropic") {
    throw new Error("Anthropic provider not available — ANTHROPIC_API_KEY is not set");
  }
  // The skill provider is AnthropicProvider when env is configured.
  return (provider as unknown as { raw: () => Anthropic }).raw();
}

// ── Streaming + Completion ──────────────────────────────────────────────────

function tierForModelId(modelId: ModelId): "skill" | "standard" | "mini" {
  const config = PROVIDER_MODELS[modelId];
  if (config.provider === "anthropic") return "skill";
  if (config.model === "gpt-4o-mini") return "mini";
  return "standard";
}

function toProviderMessages(messages: ChatMessage[]): ProviderChatMessage[] {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content };
    }
    return {
      role: m.role,
      content: m.content.map((p) => {
        if (p.type === "text") {
          return { type: "text" as const, text: p.text ?? "" };
        }
        return {
          type: "image_url" as const,
          image_url: { url: p.image_url?.url ?? "" },
        };
      }),
    };
  });
}

/**
 * Stream a completion from the appropriate provider.
 * Returns an async iterable of content chunks — provider-neutral.
 */
export async function* createStream(
  modelId: ModelId,
  messages: ChatMessage[],
  maxTokens?: number
): AsyncGenerator<StreamChunk> {
  const config = PROVIDER_MODELS[modelId];
  const tokens = maxTokens ?? config.maxTokens;
  const provider = selectProvider(tierForModelId(modelId));
  const stream = provider.stream({
    model: config.model,
    messages: toProviderMessages(messages),
    maxTokens: tokens,
  });
  for await (const chunk of stream) {
    if (chunk.content) yield { content: chunk.content };
  }
}

/**
 * Non-streaming completion. Returns the full response text.
 * Used for background tasks (memory extraction, mode detection, etc.)
 */
export async function createCompletion(
  modelId: ModelId,
  messages: ChatMessage[],
  maxTokens?: number
): Promise<string> {
  const config = PROVIDER_MODELS[modelId];
  const tokens = maxTokens ?? config.maxTokens;
  const provider = selectProvider(tierForModelId(modelId));
  const response = await provider.chat({
    model: config.model,
    messages: toProviderMessages(messages),
    maxTokens: tokens,
  });
  return response.content.trim();
}
