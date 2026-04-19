/**
 * Anthropic provider — direct SDK.
 *
 * Reads ANTHROPIC_API_KEY (required when this provider is constructed).
 * Anthropic has no first-party embedding endpoint, so embed() throws —
 * the registry routes embedding calls to OpenAI.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider,
  ChatChunk,
  ChatMessage,
  ChatParams,
  ChatResponse,
  ContentPart,
} from "./ai-provider-interface";

function extractText(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function toAnthropicFormat(messages: ChatMessage[]): {
  system: string;
  messages: Anthropic.MessageParam[];
} {
  let system = "";
  const out: Anthropic.MessageParam[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      system += (system ? "\n\n" : "") + extractText(msg.content);
    } else {
      out.push({
        role: msg.role as "user" | "assistant",
        content: extractText(msg.content),
      });
    }
  }
  if (out.length === 0) {
    out.push({ role: "user", content: "Hello" });
  }
  return { system, messages: out };
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic";

  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    this.client = new Anthropic({ apiKey });
  }

  raw(): Anthropic {
    return this.client;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const { system, messages } = toAnthropicFormat(params.messages);
    const response = await this.client.messages.create({
      model: params.model,
      system: system || undefined,
      messages,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    });
    const content = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return {
      content,
      model: params.model,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined,
    };
  }

  async *stream(params: ChatParams): AsyncIterable<ChatChunk> {
    const { system, messages } = toAnthropicFormat(params.messages);
    const stream = this.client.messages.stream({
      model: params.model,
      system: system || undefined,
      messages,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { content: event.delta.text };
      }
    }
  }

  async embed(_text: string): Promise<number[]> {
    throw new Error(
      "Anthropic does not provide an embeddings endpoint. Route embed() calls to the OpenAI provider via the registry."
    );
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
