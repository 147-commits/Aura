/**
 * Aura Design System v2 — Deep Sapphire + Wisdom Amber
 *
 * Design decisions based on research:
 * - Purple is dead for AI (Tailwind indigo-500 problem)
 * - Blue-tinted dark backgrounds instead of pure gray (premium feel)
 * - Warm amber accent prevents corporate coldness
 * - Never pure black (#000) — causes eye strain and kills depth
 * - 70/20/10 rule: 70% dark surfaces, 20% sapphire, 10% amber
 */

const palette = {
  // Primary: Deep Sapphire — trust, intelligence, clarity
  sapphire50: "#EFF6FF",
  sapphire100: "#DBEAFE",
  sapphire200: "#BFDBFE",
  sapphire400: "#60A5FA",
  sapphire500: "#3B82F6",
  sapphire600: "#2563EB",
  sapphire700: "#1D4ED8",
  sapphire900: "#1E3A5F",

  // Secondary: Truth Teal — growth, clarity for interactive elements
  teal400: "#38BDF8",
  teal500: "#0EA5E9",

  // Warm Accent: Wisdom Amber — warmth, illumination
  amber300: "#FCD34D",
  amber400: "#FBBF24",
  amber500: "#F59E0B",

  // Creative: Soft Violet — brainstorm/creative modes
  violet400: "#A78BFA",
  violet500: "#7C3AED",

  // Semantic
  emerald400: "#6EE7B7",
  emerald500: "#10B981",
  rose400: "#FCA5A5",
  rose500: "#EF4444",
  warmYellow: "#FCD34D",
} as const;

const dark = {
  // ─── Surfaces (blue-tinted near-blacks) ─────────────────────────────
  background: "#0C1220",       // deep navy-black (never pure #000)
  surface: "#162032",          // cards, chat bubbles
  surfaceSecondary: "#1E2D44", // elevated panels
  surfaceTertiary: "#273B56",  // popovers, floating elements

  // ─── Borders ────────────────────────────────────────────────────────
  border: "#1E2D44",           // default divider
  borderLight: "#273B56",      // hover / emphasis

  // ─── Text (WCAG AA+ compliant) ──────────────────────────────────────
  text: "#E2E8F0",             // primary (~14:1 on #0C1220)
  textPrimary: "#E2E8F0",
  textSecondary: "#94A3B8",    // secondary (~6.5:1)
  textTertiary: "#64748B",     // subtle/disabled (~3.8:1)

  // ─── Brand ──────────────────────────────────────────────────────────
  accent: palette.sapphire500,         // #3B82F6 — primary action
  accentHover: palette.sapphire400,    // #60A5FA — hover state
  accentSecondary: palette.teal400,    // #38BDF8 — secondary interactive
  accentWarm: palette.amber400,        // #FBBF24 — warm accent (10% rule)
  accentCreative: palette.violet400,   // #A78BFA — creative/brainstorm mode

  // ─── Glows (for orb, focus rings) ──────────────────────────────────
  accentGlow: "rgba(59, 130, 246, 0.15)",
  accentGlowStrong: "rgba(59, 130, 246, 0.30)",
  warmGlow: "rgba(251, 191, 36, 0.12)",

  // ─── Semantic (desaturated for dark mode) ───────────────────────────
  success: palette.emerald400,   // #6EE7B7
  warning: palette.warmYellow,   // #FCD34D
  error: palette.rose400,        // #FCA5A5
  info: palette.teal400,         // #38BDF8

  // ─── Confidence colors ──────────────────────────────────────────────
  confidenceHigh: palette.emerald400,
  confidenceMedium: palette.amber400,
  confidenceLow: palette.rose400,

  // ─── Tab bar ────────────────────────────────────────────────────────
  tint: palette.sapphire500,
  tabIconDefault: "#64748B",
  tabIconSelected: palette.sapphire500,

  // ─── Chat-specific ──────────────────────────────────────────────────
  userBubble: palette.sapphire600,     // #2563EB
  assistantBubble: "#162032",
  streamingCursor: palette.sapphire400,

  // ─── Mode accents ──────────────────────────────────────────────────
  modeChat: palette.sapphire500,
  modeResearch: palette.teal500,
  modeBrainstorm: palette.violet400,
  modeDecision: palette.amber400,
  modeExplain: palette.emerald400,

  // ─── Priority colors ───────────────────────────────────────────────
  priorityHigh: palette.rose400,
  priorityMedium: palette.amber400,
  priorityLow: "#64748B",

  // ─── Project palette (cycle through these for new projects) ─────────
  projectColors: [
    palette.sapphire500,
    palette.violet400,
    palette.teal400,
    palette.emerald400,
    palette.amber400,
    palette.rose400,
    "#F472B6", // pink
    "#818CF8", // indigo
  ],
} as const;

// Export both ways for backward compatibility
export default {
  dark,
  ...dark,
  palette,
};

export { dark, palette };
