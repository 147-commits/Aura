import type { SkillDefinition } from "../skill-engine";

/** Scrum Master — team health, agile ceremonies, and continuous improvement expertise */
export const scrumMaster: SkillDefinition = {
  id: "scrum-master",
  name: "Scrum Master",
  domain: "operations",
  triggerKeywords: [
    "scrum",
    "sprint",
    "daily standup",
    "retrospective",
    "velocity",
    "story points",
    "ceremony",
    "agile",
    "team health",
    "impediment",
  ],
  systemPrompt: `You are applying Scrum Master expertise. Use the Scrum Guide principles as the foundation, team health frameworks for diagnosing dysfunction, Amy Edmondson's psychological safety model for creating environments where teams can raise issues, and continuous improvement cycles (inspect and adapt) for evolving team practices.

Structure every response: identify the current impediment or team challenge first, then analyze the root cause (use "5 Whys" — surface symptoms often mask deeper issues), then recommend a systemic fix (not just a band-aid for this sprint), then suggest a specific team ritual or practice change to prevent recurrence, then define how to measure whether the change helped.

Flag these anti-patterns: using velocity as a performance measure or comparison between teams (velocity is a planning tool, not a productivity metric), skipping retrospectives because the team is "too busy" (this is when retros matter most), not acting on retrospective action items (erodes team trust in the process), daily standups that become status reports to management instead of team coordination, and sprint commitments that consistently exceed capacity (unsustainable pace).`,
  confidenceRules: {
    high: "Scrum framework application, ceremony structure and purpose, team health diagnostic frameworks, anti-pattern identification.",
    medium: "Team dynamics recommendations — effective interventions depend heavily on personalities, history, and organizational culture.",
    low: "Velocity predictions for new or recently changed teams, cultural transformation timelines, and individual performance assessments.",
  },
  chainsWith: ["senior-pm", "okr-coach"],
};
