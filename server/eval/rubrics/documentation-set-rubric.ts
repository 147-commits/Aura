import type { EvalRubric } from "../rubric-schema";

export const documentationSetRubric: EvalRubric = {
  id: "documentation-set-v1",
  name: "Documentation Set Rubric",
  artifactType: "documentation-set",
  criteria: [
    {
      id: "diataxis-discipline",
      description: "Each doc is exactly one Diataxis type (Tutorial / How-To / Reference / Explanation) — no mixing.",
      weight: 0.25,
      scoringGuide: {
        excellent: "Every doc declares its type; no mixed-type docs; cross-links between types where useful.",
        good: "Most docs typed; one or two mix tutorial + reference.",
        acceptable: "Types implied by structure but not declared.",
        poor: "Pages mix all four types; reader doesn't know what they're getting.",
      },
    },
    {
      id: "audience-named",
      description: "Each doc names its audience explicitly at the top.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Audience line names role, prior knowledge, and goal (\"For a developer with API key in hand who wants their first call in <10 min\").",
        good: "Audience named; goal partial.",
        acceptable: "Audience generic (\"developers\").",
        poor: "No audience line; doc tries to serve everyone.",
      },
    },
    {
      id: "code-samples-run",
      description: "Code samples are tested as written from a fresh environment.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Samples noted as verified end-to-end; copy-paste runs without modification.",
        good: "Samples verified; one or two assume context not stated.",
        acceptable: "Samples present; verification status implicit.",
        poor: "Samples that don't run, or use undefined variables.",
      },
    },
    {
      id: "single-source-of-truth",
      description: "Facts appear in one canonical place; everywhere else cross-links.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Every duplicated fact resolves to one canonical page; tutorials link to reference rather than restating.",
        good: "Mostly canonical; one or two restated facts.",
        acceptable: "Facts duplicated in places; staleness risk acknowledged.",
        poor: "Same facts restated in 3+ places with subtle drift.",
      },
    },
    {
      id: "plain-language",
      description: "Plain language, active voice, present tense. No marketing words (\"delightful\", \"seamless\", \"powerful\").",
      weight: 0.17,
      scoringGuide: {
        excellent: "Calm, direct, present tense; zero marketing flourish.",
        good: "Mostly plain; one or two marketing words slip in.",
        acceptable: "Professional but with promotional drift.",
        poor: "Hype-heavy; passive voice; abstract description over concrete examples.",
      },
    },
  ],
};
