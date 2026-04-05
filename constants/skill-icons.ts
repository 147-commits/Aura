/**
 * Skill Icons — maps skill IDs and domains to Ionicons names.
 * Uses Ionicons (already installed) instead of lucide to avoid new dependencies.
 */

import type { Ionicons } from "@expo/vector-icons";

type IconName = keyof typeof Ionicons.glyphMap;

export const SKILL_ICONS: Record<string, IconName> = {
  "general": "sparkles-outline",
  "engineering-architect": "grid-outline",
  "engineering-code-reviewer": "code-slash-outline",
  "security-auditor": "shield-checkmark-outline",
  "fullstack-engineer": "layers-outline",
  "data-engineer": "server-outline",
  "gtm-strategist": "rocket-outline",
  "content-strategist": "document-text-outline",
  "growth-marketer": "trending-up-outline",
  "brand-strategist": "color-palette-outline",
  "product-manager": "cube-outline",
  "ux-researcher": "people-outline",
  "roadmap-planner": "map-outline",
  "financial-analyst": "bar-chart-outline",
  "saas-metrics-coach": "pie-chart-outline",
  "investor-relations": "cash-outline",
  "startup-ceo": "rocket-outline",
  "cto-advisor": "hardware-chip-outline",
  "okr-coach": "compass-outline",
  "senior-pm": "clipboard-outline",
  "scrum-master": "refresh-outline",
  "technical-writer": "pencil-outline",
  "legal-contract-reviewer": "document-lock-outline",
  "legal-compliance-advisor": "shield-outline",
  "curriculum-designer": "school-outline",
  "tutoring-expert": "bulb-outline",
  "wellness-coach": "heart-outline",
};

export const DOMAIN_ICONS: Record<string, IconName> = {
  engineering: "code-slash-outline",
  marketing: "megaphone-outline",
  product: "cube-outline",
  finance: "bar-chart-outline",
  leadership: "compass-outline",
  operations: "settings-outline",
  legal: "shield-checkmark-outline",
  education: "school-outline",
  health: "heart-outline",
};
