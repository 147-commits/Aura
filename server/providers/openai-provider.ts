/**
 * OpenAI provider — direct SDK.
 *
 * Reads OPENAI_API_KEY (required) and OPENAI_BASE_URL (optional).
 * Embeddings use text-embedding-3-small.
 */

import OpenAI from "openai";
import type {
  AIProvider,
  ChatChunk,
  ChatMessage,
  ChatParams,
  ChatResponse,
  ContentPart,
} from "./ai-provider-interface";

const EMBEDDING_MODEL = "text-embedding-3-small";

function toOpenAIMessages(messages: ChatMessage[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content } as OpenAI.ChatCompletionMessageParam;
    }
    const parts = m.content.map((p: ContentPart) => {
      if (p.type === "text") return { type: "text" as const, text: p.text };
      return { type: "image_url" as const, image_url: { url: p.image_url.url } };
    });
    return { role: m.role, content: parts as any } as OpenAI.ChatCompletionMessageParam;
  });
}

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly name = "OpenAI";

  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }

  /** Expose the underlying SDK for callers that need OpenAI-specific features (Responses API, embeddings, etc.) */
  raw(): OpenAI {
    return this.client;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: params.model,
      messages: toOpenAIMessages(params.messages),
      max_completion_tokens: params.maxTokens,
      temperature: params.temperature,
    });
    const content = response.choices[0]?.message?.content?.trim() ?? "";
    return {
      content,
      model: params.model,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens ?? 0,
            outputTokens: response.usage.completion_tokens ?? 0,
          }
        : undefined,
    };
  }

  async *stream(params: ChatParams): AsyncIterable<ChatChunk> {
    const stream = await this.client.chat.completions.create({
      model: params.model,
      messages: toOpenAIMessages(params.messages),
      max_completion_tokens: params.maxTokens,
      temperature: params.temperature,
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) yield { content };
    }
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0]?.embedding ?? [];
  }

  countTokens(text: string): number {
    // OpenAI does not expose a tokenizer in the SDK. ~4 chars per token is a
    // standard heuristic for English; close enough for budgeting.
    return Math.ceil(text.length / 4);
  }
}
