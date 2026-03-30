/**
 * Aura Design System v3 — Sapphire Prism Palette
 *
 * Design philosophy: Aura is a personal companion, not a productivity app.
 * The palette feels: intelligent, calm, trustworthy, with moments of warmth.
 * Deep sapphire for clarity. Warm amber for insight. Never cold. Never clinical.
 *
 * Palette rules:
 *   - Never pure black (#000) — causes eye strain and kills depth
 *   - Blue-tinted dark backgrounds for premium depth
 *   - 70/20/10 rule: 70% dark surfaces, 20% sapphire, 10% amber
 *   - All text meets WCAG AA+ contrast on BG_PRIMARY
 *
 * Migration from v2:
 *   - background: #0C1220 → #0A0F1E (deeper, richer space)
 *   - surface: #162032 → #111827 (slightly cooler)
 *   - accent: #3B82F6 → #4F7FFF (Electric Sapphire — more distinctive)
 *   - accentWarm: #FBBF24 → #E8A84C (Wisdom Gold — warmer, less saturated)
 *   - All existing property names preserved as aliases
 */

// ─── Foundation Palette ────────────────────────────────────────────────────

const palette = {
  // Primary: Electric Sapphire — trust, intelligence, clarity
  sapphire50: "#EFF6FF",
  sapphire100: "#DBEAFE",
  sapphire200: "#BFDBFE",
  sapphire400: "#6B9BFF",
  sapphire500: "#4F7FFF",      // ← new primary brand
  sapphire600: "#3B6AE6",
  sapphire700: "#2A52CC",
  sapphire900: "#1E3A5F",

  // Secondary: Sky — clarity for interactive elements
  teal400: "#38BDF8",
  teal500: "#0EA5E9",

  // Warm Accent: Wisdom Gold — warmth, illumination
  amber300: "#FCD34D",
  amber400: "#E8A84C",         // ← new warm accent
  amber500: "#D4943F",

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

// ─── Sapphire Prism Theme ──────────────────────────────────────────────────

const dark = {
  // ─── Backgrounds ───────────────────────────────────────────────────────
  background: "#0A0F1E",          // Deep space — main screen (BG_PRIMARY)
  surface: "#111827",             // Elevated surface — cards, modals (BG_SURFACE)
  surfaceSecondary: "#1A2332",    // Double-elevated — dropdowns, skill picker (BG_SURFACE_2)
  surfaceTertiary: "#243044",     // Triple-elevated — active states (BG_SURFACE_3)

  // ─── Borders ───────────────────────────────────────────────────────────
  border: "#1E2D44",              // Subtle separator
  borderLight: "#2A3F5F",        // Active/focused border (BORDER_ACTIVE)

  // ─── Text (WCAG AA+ compliant on #0A0F1E) ─────────────────────────────
  text: "#E2E8F0",               // Primary readable text (~14:1)
  textPrimary: "#E2E8F0",       // Alias for text
  textSecondary: "#94A3B8",     // Subdued labels, metadata (~6.5:1)
  textTertiary: "#64748B",      // Placeholder, disabled (~3.8:1)

  // ─── Brand Accents ─────────────────────────────────────────────────────
  accent: "#4F7FFF",                      // Electric Sapphire — primary brand
  accentHover: palette.sapphire400,       // #6B9BFF — hover state
  accentSecondary: palette.teal400,       // #38BDF8 — secondary interactive
  accentWarm: "#E8A84C",                  // Wisdom Gold — insight moments
  accentCreative: palette.violet400,      // #A78BFA — creative/brainstorm mode

  // ─── Glows ─────────────────────────────────────────────────────────────
  accentGlow: "rgba(79, 127, 255, 0.15)",         // ACCENT_SAPPHIRE_GLOW
  accentGlowStrong: "rgba(79, 127, 255, 0.30)",
  warmGlow: "rgba(232, 168, 76, 0.12)",           // ACCENT_AMBER_GLOW

  // ─── Semantic ──────────────────────────────────────────────────────────
  success: "#6EE7B7",            // Mint — positive states
  warning: "#FCD34D",            // Yellow — caution states
  error: "#FCA5A5",              // Soft red — error states
  info: "#38BDF8",               // Sky — informational

  // ─── Confidence Badge Colors ───────────────────────────────────────────
  confidenceHigh: "#6EE7B7",     // Green
  confidenceMedium: "#E8A84C",   // Amber (updated from #FBBF24)
  confidenceLow: "#FCA5A5",      // Red

  // ─── Domain Skill Colors (skill picker UI) ─────────────────────────────
  domainEngineering: "#38BDF8",  // Sky blue
  domainMarketing: "#F472B6",    // Pink
  domainProduct: "#A78BFA",      // Violet
  domainFinance: "#6EE7B7",      // Mint
  domainLeadership: "#E8A84C",   // Amber
  domainOperations: "#94A3B8",   // Slate

  // ─── Gradients ─────────────────────────────────────────────────────────
  gradientThinking: ["#4F7FFF", "#E8A84C"] as readonly [string, string],
  gradientHero: ["#E2E8F0", "#4F7FFF", "#E8A84C"] as readonly [string, string, string],
  gradientSurface: ["#111827", "#0A0F1E"] as readonly [string, string],

  // ─── Shadows ───────────────────────────────────────────────────────────
  shadowSm: "rgba(0,0,0,0.3)",
  shadowMd: "rgba(0,0,0,0.5)",
  shadowGlowAccent: "rgba(79, 127, 255, 0.2)",

  // ─── Tab Bar ───────────────────────────────────────────────────────────
  tint: "#4F7FFF",
  tabIconDefault: "#64748B",
  tabIconSelected: "#4F7FFF",

  // ─── Chat-specific ─────────────────────────────────────────────────────
  userBubble: "#3B6AE6",
  assistantBubble: "#111827",
  streamingCursor: palette.sapphire400,

  // ─── Mode Accents ──────────────────────────────────────────────────────
  modeChat: "#4F7FFF",
  modeResearch: palette.teal500,
  modeBrainstorm: palette.violet400,
  modeDecision: "#E8A84C",
  modeExplain: palette.emerald400,

  // ─── Priority Colors ──────────────────────────────────────────────────
  priorityHigh: "#FCA5A5",
  priorityMedium: "#E8A84C",
  priorityLow: "#64748B",

  // ─── Project Palette (cycle through for new projects) ──────────────────
  projectColors: [
    "#4F7FFF",           // Electric Sapphire
    "#A78BFA",           // Violet
    "#38BDF8",           // Sky
    "#6EE7B7",           // Mint
    "#E8A84C",           // Amber
    "#FCA5A5",           // Rose
    "#F472B6",           // Pink
    "#818CF8",           // Indigo
  ] as readonly string[],
} as const;

// ─── Domain Color Lookup (typed for skill-engine SkillDomain) ──────────────

export const DOMAIN_COLORS: Record<string, string> = {
  engineering: dark.domainEngineering,
  marketing: dark.domainMarketing,
  product: dark.domainProduct,
  finance: dark.domainFinance,
  leadership: dark.domainLeadership,
  operations: dark.domainOperations,
};

// ─── Exports ────────────────────────────────────────────────────────────────

// Export both ways for backward compatibility
export default {
  dark,
  ...dark,
  palette,
};

export { dark, palette };
