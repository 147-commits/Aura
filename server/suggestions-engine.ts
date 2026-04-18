/**
 * Smart Suggestions Engine — generates contextual follow-up suggestions after AI responses.
 *
 * Replaces static QuickChips with dynamic, context-aware suggestions.
 * Uses GPT-4o-mini for cheap, fast generation.
 */

import { getOpenAI } from "./ai-provider";
import type { ChatMode } from "./truth-engine";

export interface Suggestion {
  text: string;
  mode?: ChatMode;
}

const MODE_SUGGESTION_TEMPLATES: Record<string, string[]> = {
  research: [
    "Go deeper on the key finding",
    "Compare with alternative approaches",
    "What are the limitations of this research?",
  ],
  decision: [
    "What are the risks of this choice?",
    "Create an action plan for this decision",
    "What would change if we chose the other option?",
  ],
  brainstorm: [
    "Refine the top 3 ideas",
    "Create a project plan for the best idea",
    "What resources would we need?",
  ],
  explain: [
    "Give me a real-world example",
    "How does this compare to alternatives?",
    "What are common misconceptions?",
  ],
  chat: [
    "Tell me more about this",
    "How do I get started?",
    "What should I watch out for?",
  ],
};

/**
 * Generate 2-3 contextual follow-up suggestions based on the AI response and mode.
 * Uses GPT-4o-mini for dynamic suggestions, falls back to templates.
 */
export async function generateSuggestions(
  userMessage: string,
  aiResponse: string,
  mode: ChatMode
): Promise<Suggestion[]> {
  // Try AI-generated suggestions first
  try {
    const openai = getOpenAI();
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Based on this conversation, suggest 3 short follow-up questions the user might want to ask. Each should be under 8 words, actionable, and naturally continue the conversation.

User asked: "${userMessage.slice(0, 200)}"
AI responded about: "${aiResponse.slice(0, 300)}"
Mode: ${mode}

Return ONLY a JSON array of 3 strings. No explanation.
Example: ["Go deeper on pricing", "Compare with competitors", "Create an action plan"]`,
      }],
      max_completion_tokens: 100,
    });

    const raw = result.choices[0]?.message?.content?.trim() || "[]";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const suggestions = JSON.parse(cleaned);

    if (Array.isArray(suggestions) && suggestions.length > 0) {
      return suggestions.slice(0, 3).map((text: string) => ({ text }));
    }
  } catch {
    // Fall back to templates
  }

  // Template fallback
  const templates = MODE_SUGGESTION_TEMPLATES[mode] || MODE_SUGGESTION_TEMPLATES.chat;
  return templates.slice(0, 3).map((text) => ({ text, mode }));
}
