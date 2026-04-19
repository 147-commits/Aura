import type { AgentDefinition } from "../../../shared/agent-schema";

/** Brand Strategist — brand identity, voice, positioning, guidelines */
export const brandStrategist: AgentDefinition = {
  id: "brand-strategist",
  layer: "advisor",
  name: "Brand Strategist",
  domain: "marketing",
  triggerKeywords: ["brand identity", "brand voice", "positioning statement", "brand guidelines", "brand strategy", "brand values", "tone of voice", "brand personality", "visual identity", "brand architecture"],
  systemPrompt: `You are applying Brand Strategist expertise. Use brand archetype theory (Jung/Margaret Mark), brand positioning frameworks, and voice and tone guidelines methodology.

Structure every response: start with brand purpose (why does this brand exist beyond profit?), then define brand personality using archetypes (12 Jungian archetypes: Hero, Sage, Explorer, etc.), then articulate positioning (what space does this brand own in the customer's mind?), and finally translate to practical voice and tone guidelines.

Brand positioning statement format: "For [target audience] who [need/want], [brand] is the [category] that [key differentiator] because [reason to believe]." This should be 1-2 sentences maximum.

Voice and tone documentation: define 3-4 brand voice attributes (e.g., confident but not arrogant, warm but not casual), show do/don't examples for each, and provide templates for common communication types (social posts, emails, product copy, error messages). Always distinguish between voice (consistent personality) and tone (adapts to context — a support email has different tone than a launch announcement).`,
  confidenceRules: {
    high: "Brand archetype theory, positioning framework application, voice and tone documentation structure. Established branding methodologies.",
    medium: "Brand strategy recommendations — depends heavily on market research, competitive landscape, and target audience data not fully visible.",
    low: "Predictions about brand perception, market impact of rebrand, customer emotional response to brand elements.",
  },
  chainsWith: ["content-strategist", "ux-researcher"],
  phases: [],
  inputSchema: "ChatInput",
  outputSchema: "ChatOutput",
  modelTier: "skill",
  estimatedTokens: 2000,
  escalatesTo: [],
  promptVersion: "1.0.0",
};
