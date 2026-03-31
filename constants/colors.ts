/**
 * Aura Design System v4 — Sage Light
 *
 * Warm white. Sage green. Zen clarity.
 * Aura is a calm, intelligent companion — not a dark terminal.
 * The palette feels: warm, trustworthy, grounded, alive.
 */

const palette = {
  sage50: "#F5F7F2",
  sage100: "#EBF0E6",
  sage200: "#D4DEC9",
  sage300: "#B5C4A5",
  sage400: "#8BA574",
  sage500: "#6B8C54",
  sage600: "#547042",
  sage700: "#3D5230",
  sage800: "#2C3B22",

  cream: "#FAFAF5",
  warmWhite: "#F7F6F1",
  warmGray50: "#F5F4EF",
  warmGray100: "#E8E6E1",
  warmGray200: "#D4D2CD",
  warmGray300: "#B5B3AE",
  warmGray400: "#8A8884",
  warmGray500: "#6B6966",
  warmGray600: "#52504D",

  emerald400: "#6EE7B7",
  emerald500: "#10B981",
  rose400: "#FCA5A5",
  rose500: "#EF4444",
  amber400: "#E8A84C",
  violet400: "#A78BFA",
  teal400: "#38BDF8",
} as const;

// ─── Sage Light Theme ──────────────────────────────────────────────────────

const dark = {
  // ─── Backgrounds ───────────────────────────────────────────────────────
  background: palette.cream,              // #FAFAF5 — warm cream
  backgroundCenter: palette.warmWhite,    // #F7F6F1
  surface: "#FFFFFF",                     // Pure white — cards, bubbles
  surfaceSecondary: palette.warmGray50,   // #F5F4EF — elevated
  surfaceTertiary: palette.warmGray100,   // #E8E6E1 — active states
  surfaceSidebar: palette.warmWhite,      // #F7F6F1

  // ─── Borders ───────────────────────────────────────────────────────────
  border: palette.warmGray100,            // #E8E6E1
  borderLight: palette.warmGray200,       // #D4D2CD

  // ─── Text ──────────────────────────────────────────────────────────────
  text: "#1A1A1A",                        // Near-black
  textPrimary: "#1A1A1A",
  textSecondary: palette.warmGray500,     // #6B6966
  textTertiary: palette.warmGray400,      // #8A8884

  // ─── Brand Accents (Sage Green) ────────────────────────────────────────
  accent: palette.sage500,                // #6B8C54 — primary brand
  accentHover: palette.sage400,           // #8BA574
  accentSecondary: palette.sage600,       // #547042
  accentWarm: palette.amber400,           // #E8A84C
  accentCreative: palette.violet400,      // #A78BFA

  // ─── Glows ─────────────────────────────────────────────────────────────
  accentGlow: "rgba(107, 140, 84, 0.12)",
  accentGlowStrong: "rgba(107, 140, 84, 0.20)",
  warmGlow: "rgba(232, 168, 76, 0.12)",
  warmGlowStrong: "rgba(232, 168, 76, 0.20)",

  // ─── Semantic ──────────────────────────────────────────────────────────
  success: palette.sage500,
  warning: "#E8A84C",
  error: "#EF4444",
  info: palette.teal400,

  // ─── Confidence Badge Colors ───────────────────────────────────────────
  confidenceHigh: palette.sage500,        // Sage green
  confidenceMedium: "#E8A84C",            // Amber
  confidenceLow: "#EF4444",               // Red

  // ─── Domain Skill Colors ───────────────────────────────────────────────
  domainEngineering: "#38BDF8",
  domainMarketing: "#F472B6",
  domainProduct: "#A78BFA",
  domainFinance: "#6EE7B7",
  domainLeadership: "#E8A84C",
  domainOperations: palette.warmGray400,

  // ─── Gradients ─────────────────────────────────────────────────────────
  gradientThinking: [palette.sage500, palette.sage300] as readonly [string, string],
  gradientHero: ["#1A1A1A", palette.sage500, palette.sage300] as readonly [string, string, string],
  gradientSurface: [palette.warmWhite, palette.cream] as readonly [string, string],

  // ─── Shadows ───────────────────────────────────────────────────────────
  shadowSm: "rgba(0,0,0,0.06)",
  shadowMd: "rgba(0,0,0,0.10)",
  shadowGlowAccent: "rgba(107, 140, 84, 0.15)",

  // ─── Tab Bar ───────────────────────────────────────────────────────────
  tint: palette.sage500,
  tabIconDefault: palette.warmGray400,
  tabIconSelected: palette.sage500,

  // ─── Chat-specific ─────────────────────────────────────────────────────
  userBubble: palette.sage500,
  userBubbleEnd: palette.sage600,
  assistantBubble: "#FFFFFF",
  assistantBubbleEnd: palette.warmGray50,
  assistantBubbleBorder: palette.warmGray100,
  assistantBubbleAccent: "rgba(107, 140, 84, 0.3)",
  streamingCursor: palette.sage400,

  // ─── Mode Accents ──────────────────────────────────────────────────────
  modeChat: palette.sage500,
  modeResearch: palette.teal400,
  modeBrainstorm: palette.violet400,
  modeDecision: palette.amber400,
  modeExplain: palette.emerald500,

  // ─── Priority Colors ──────────────────────────────────────────────────
  priorityHigh: palette.rose400,
  priorityMedium: palette.amber400,
  priorityLow: palette.warmGray400,

  // ─── Project Palette ──────────────────────────────────────────────────
  projectColors: [
    palette.sage500,
    palette.violet400,
    palette.teal400,
    palette.emerald400,
    palette.amber400,
    palette.rose400,
    "#F472B6",
    "#818CF8",
  ] as readonly string[],
} as const;

// ─── Domain Color Lookup ──────────────────────────────────────────────────

export const DOMAIN_COLORS: Record<string, string> = {
  engineering: dark.domainEngineering,
  marketing: dark.domainMarketing,
  product: dark.domainProduct,
  finance: dark.domainFinance,
  leadership: dark.domainLeadership,
  operations: dark.domainOperations,
};

export default {
  dark,
  ...dark,
  palette,
};

export { dark, palette };
