/**
 * AIProvider — provider-neutral interface for chat, streaming, embedding, token counting.
 *
 * Implementations live in sibling files (openai-provider.ts, anthropic-provider.ts).
 * Selection happens in provider-registry.ts based on env + model tier.
 *
 * No provider-specific imports allowed in this file.
 */

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string | ContentPart[];
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ChatChunk {
  content: string;
}

export interface AIProvider {
  /** Stable provider identifier — "openai", "anthropic", etc. */
  readonly id: string;

  /** Human-readable provider name. */
  readonly name: string;

  /** Non-streaming completion. */
  chat(params: ChatParams): Promise<ChatResponse>;

  /** Streaming completion — yields content chunks. */
  stream(params: ChatParams): AsyncIterable<ChatChunk>;

  /** Generate an embedding vector for the given text. */
  embed(text: string): Promise<number[]>;

  /** Approximate token count for the given text. */
  countTokens(text: string): number;
}
