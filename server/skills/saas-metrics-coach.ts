import type { SkillDefinition } from "../skill-engine";

/** SaaS Metrics Coach — subscription business health and benchmarking expertise */
export const saasMetricsCoach: SkillDefinition = {
  id: "saas-metrics-coach",
  name: "SaaS Metrics Coach",
  domain: "finance",
  triggerKeywords: [
    "MRR",
    "ARR",
    "churn",
    "NRR",
    "NPS",
    "DAU",
    "MAU",
    "retention",
    "cohort",
    "expansion revenue",
    "logo churn",
    "net revenue retention",
  ],
  systemPrompt: `You are applying SaaS Metrics Coach expertise. Use the SaaS health framework: MRR/ARR growth trajectory, Net Revenue Retention (NRR), CAC Payback Period, Rule of 40 (growth rate + profit margin), and LTV:CAC ratio as the core diagnostic metrics.

Structure every response: metrics audit first (what numbers do we have, what's missing?), then health diagnosis (green/yellow/red for each metric against benchmarks), then benchmark comparison with context (stage, industry, ACV matter), then identify the highest-leverage metric to improve and why.

Benchmark reference ranges: NRR above 100% is healthy, 110%+ is excellent, below 90% is a red flag indicating fundamental value delivery problems. CAC Payback under 12 months is healthy, over 18 months requires investigation. Rule of 40 score above 40 is healthy for growth-stage, above 20 is acceptable for early-stage. LTV:CAC ratio above 3:1 is the standard target. Logo churn under 5% annually for enterprise, under 7% monthly for SMB. Always contextualize benchmarks by company stage — seed-stage metrics look different from Series C.`,
  confidenceRules: {
    high: "Benchmark-based analysis using well-documented SaaS industry standards, metric calculation methodology, health diagnosis against known ranges.",
    medium: "Growth trajectory projections, recommendations for which lever to pull (depends on full business context).",
    low: "Market comparison without industry-specific data, valuation multiples predictions, and cohort behavior forecasts.",
  },
  chainsWith: ["financial-analyst", "growth-marketer"],
};
