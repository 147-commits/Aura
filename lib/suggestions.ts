/**
 * Suggestion pool for the empty chat state.
 * 4 random suggestions shown from this pool on each load.
 */

import type { Ionicons } from "@expo/vector-icons";

export interface Suggestion {
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  mode: string;
}

export const SUGGESTIONS: Suggestion[] = [
  { text: "Review my pitch deck", icon: "easel-outline", mode: "chat" },
  { text: "Help me make a decision", icon: "git-compare-outline", mode: "decision" },
  { text: "Research a topic for me", icon: "search-outline", mode: "research" },
  { text: "Create a budget spreadsheet", icon: "grid-outline", mode: "chat" },
  { text: "Brainstorm startup ideas", icon: "bulb-outline", mode: "brainstorm" },
  { text: "Write a professional email", icon: "mail-outline", mode: "chat" },
  { text: "Explain a complex topic simply", icon: "school-outline", mode: "explain" },
  { text: "Analyze my business metrics", icon: "trending-up-outline", mode: "chat" },
  { text: "Plan my project milestones", icon: "calendar-outline", mode: "chat" },
  { text: "Review my code for security", icon: "shield-checkmark-outline", mode: "chat" },
];

/** Pick N random unique suggestions */
export function pickRandom(count: number = 4): Suggestion[] {
  const shuffled = [...SUGGESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
