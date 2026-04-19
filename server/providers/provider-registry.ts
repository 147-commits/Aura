/**
 * Provider registry — selects an AIProvider based on tier and env.
 *
 * Routing:
 *   - "frontier" / "skill" tiers prefer Anthropic when ANTHROPIC_API_KEY is set;
 *     fall back to OpenAI.
 *   - "standard" / "mini" tiers always use OpenAI.
 *   - Embeddings always use OpenAI (Anthropic has no embeddings API).
 *
 * Provider instances are cached for the process lifetime.
 */

import type { AIProvider } from "./ai-provider-interface";
import { AnthropicProvider } from "./anthropic-provider";
import { OpenAIProvider } from "./openai-provider";

export type ModelTier = "mini" | "standard" | "skill" | "frontier";

let openaiInstance: OpenAIProvider | null = null;
let anthropicInstance: AnthropicProvider | null = null;
let logged = false;

function getOpenAIProvider(): OpenAIProvider {
  if (!openaiInstance) openaiInstance = new OpenAIProvider();
  return openaiInstance;
}

function getAnthropicProvider(): AnthropicProvider {
  if (!anthropicInstance) anthropicInstance = new AnthropicProvider();
  return anthropicInstance;
}

function logSelectionOnce(): void {
  if (logged) return;
  logged = true;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const high = hasAnthropic ? "anthropic" : "openai";
  console.log(`Provider: openai (default), ${high} (skill/frontier)`);
  if (!hasOpenAI) {
    console.warn("[provider-registry] OPENAI_API_KEY not set — chat/embeddings will fail at call time.");
  }
}

/** Select the provider for a given tier. Cached. */
export function selectProvider(tier: ModelTier): AIProvider {
  logSelectionOnce();
  if ((tier === "skill" || tier === "frontier") && process.env.ANTHROPIC_API_KEY) {
    return getAnthropicProvider();
  }
  return getOpenAIProvider();
}

/** Always returns the OpenAI provider — used for embeddings and OpenAI-specific features. */
export function getOpenAIProviderInstance(): OpenAIProvider {
  return getOpenAIProvider();
}

/** Reset cached provider instances. Test-only. */
export function _resetProvidersForTesting(): void {
  openaiInstance = null;
  anthropicInstance = null;
  logged = false;
}
