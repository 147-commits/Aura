/**
 * A/B Test Framework — hash-based variant assignment.
 *
 * Deterministic from userId — same user always gets same variant.
 * Both variants are always built; selection only controls visibility.
 *
 * Variant A (show-work): All truth UI components visible — composite score,
 *   inline citations, source quality bar, disagreement cards, verify buttons.
 * Variant B (silent-confidence): Only show ConfidenceBadge when score < 60%.
 */

export type TruthUXVariant = "show-work" | "silent-confidence";

/**
 * Get the truth UX variant for a user.
 * Hash-based 50/50 split — deterministic from userId.
 */
export function getTruthUXVariant(userId: string): TruthUXVariant {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 2 === 0 ? "show-work" : "silent-confidence";
}

/**
 * Check if a specific truth UI component should be visible
 * based on the user's variant and the confidence score.
 */
export function shouldShowTruthUI(
  variant: TruthUXVariant,
  compositeScore?: number
): {
  showCompositeScore: boolean;
  showInlineCitations: boolean;
  showSourceBar: boolean;
  showDisagreements: boolean;
  showVerifyButtons: boolean;
  showConfidenceBadge: boolean;
} {
  if (variant === "show-work") {
    return {
      showCompositeScore: true,
      showInlineCitations: true,
      showSourceBar: true,
      showDisagreements: true,
      showVerifyButtons: true,
      showConfidenceBadge: true,
    };
  }

  // silent-confidence: only show badge when confidence is low
  const isLowConfidence = compositeScore !== undefined && compositeScore < 60;
  return {
    showCompositeScore: false,
    showInlineCitations: false,
    showSourceBar: false,
    showDisagreements: true, // Always show disagreements — too important to hide
    showVerifyButtons: false,
    showConfidenceBadge: isLowConfidence,
  };
}
