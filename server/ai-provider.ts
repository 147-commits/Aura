/**
 * AI Provider — unified interface for OpenAI and Anthropic (Claude).
 *
 * Strategy:
 *   - Claude Sonnet → skill responses (less hallucination, better structured prompts)
 *   - GPT-4o-mini  → routing, classification, background tasks (cheap, fast)
 *   - GPT-4o       → research, complex non-skill queries (fallback standard)
 *
 * Both providers expose the same streaming interface so routes.ts
 * doesn't need to know which model is answering.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ── Provider Types ──────────────────────────────────────────────────────────

export type Provider = "openai" | "anthropic";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
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

// ── Client Instances ────────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

/** Get or create the OpenAI client */
export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

/** Get or create the Anthropic client */
export function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
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

// ── Streaming Interface ─────────────────────────────────────────────────────

/**
 * Create a streaming completion using the appropriate provider.
 * Returns an async iterable of content chunks — same interface regardless of provider.
 */
export async function* createStream(
  modelId: ModelId,
  messages: ChatMessage[],
  maxTokens?: number
): AsyncGenerator<StreamChunk> {
  const config = PROVIDER_MODELS[modelId];
  const tokens = maxTokens ?? config.maxTokens;

  if (config.provider === "anthropic") {
    yield* streamAnthropic(config.model, messages, tokens);
  } else {
    yield* streamOpenAI(config.model, messages, tokens);
  }
}

/**
 * Create a non-streaming completion. Returns the full response text.
 * Used for background tasks (memory extraction, mode detection, etc.)
 */
export async function createCompletion(
  modelId: ModelId,
  messages: ChatMessage[],
  maxTokens?: number
): Promise<string> {
  const config = PROVIDER_MODELS[modelId];
  const tokens = maxTokens ?? config.maxTokens;

  if (config.provider === "anthropic") {
    return completeAnthropic(config.model, messages, tokens);
  } else {
    return completeOpenAI(config.model, messages, tokens);
  }
}

// ── OpenAI Implementation ───────────────────────────────────────────────────

async function* streamOpenAI(
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): AsyncGenerator<StreamChunk> {
  const client = getOpenAI();
  const stream = await client.chat.completions.create({
    model,
    messages: messages as OpenAI.ChatCompletionMessageParam[],
    stream: true,
    max_completion_tokens: maxTokens,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      yield { content };
    }
  }
}

async function completeOpenAI(
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model,
    messages: messages as OpenAI.ChatCompletionMessageParam[],
    max_completion_tokens: maxTokens,
  });
  return response.choices[0]?.message?.content?.trim() || "";
}

// ── Anthropic Implementation ────────────────────────────────────────────────

/**
 * Convert ChatMessage[] to Anthropic's format.
 * Anthropic requires system prompt as a separate parameter, not in messages array.
 */
function toAnthropicFormat(messages: ChatMessage[]): {
  system: string;
  messages: Anthropic.MessageParam[];
} {
  let system = "";
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      // Anthropic takes system as a separate param
      system += (system ? "\n\n" : "") + extractText(msg.content);
    } else {
      anthropicMessages.push({
        role: msg.role as "user" | "assistant",
        content: extractText(msg.content),
      });
    }
  }

  // Anthropic requires at least one user message
  if (anthropicMessages.length === 0) {
    anthropicMessages.push({ role: "user", content: "Hello" });
  }

  return { system, messages: anthropicMessages };
}

function extractText(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("\n");
}

async function* streamAnthropic(
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): AsyncGenerator<StreamChunk> {
  const client = getAnthropic();
  const { system, messages: anthropicMessages } = toAnthropicFormat(messages);

  const stream = client.messages.stream({
    model,
    system: system || undefined,
    messages: anthropicMessages,
    max_tokens: maxTokens,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { content: event.delta.text };
    }
  }
}

async function completeAnthropic(
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const client = getAnthropic();
  const { system, messages: anthropicMessages } = toAnthropicFormat(messages);

  const response = await client.messages.create({
    model,
    system: system || undefined,
    messages: anthropicMessages,
    max_tokens: maxTokens,
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}
