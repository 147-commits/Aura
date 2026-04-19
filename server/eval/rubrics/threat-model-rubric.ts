import type { EvalRubric } from "../rubric-schema";

export const threatModelRubric: EvalRubric = {
  id: "threat-model-v1",
  name: "Threat Model Rubric",
  artifactType: "threat-model",
  criteria: [
    {
      id: "data-flow-clarity",
      description: "Data flow described: entry points, components, datastores, trust boundaries — all named.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Trust boundaries explicit; every component on each side named; data crossing boundaries labelled with classification.",
        good: "Boundaries present; one or two components vague.",
        acceptable: "Trust boundaries implied not labelled.",
        poor: "No data flow; threats described in isolation from system shape.",
      },
    },
    {
      id: "stride-coverage",
      description: "Every trust boundary is walked through STRIDE (Spoofing, Tampering, Repudiation, Info Disclosure, DoS, EoP).",
      weight: 0.25,
      scoringGuide: {
        excellent: "Every boundary × STRIDE cell considered; absent threats explicitly noted as N/A with reason.",
        good: "STRIDE applied to most boundaries; some categories skipped without reasoning.",
        acceptable: "STRIDE referenced; coverage uneven.",
        poor: "No STRIDE structure; threats listed ad-hoc.",
      },
    },
    {
      id: "severity-justified",
      description: "Threats ranked Critical/High/Medium/Low using CVSS-style impact + exploitability reasoning.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Each severity stated with explicit impact + exploitability rationale.",
        good: "Severity stated; rationale partial.",
        acceptable: "Severity asserted without justification.",
        poor: "No severity, or all threats rated the same.",
      },
    },
    {
      id: "mitigations-actionable",
      description: "Each Critical/High threat has a named mitigation with owner and target completion phase.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Every Critical/High has mitigation + owner + phase + verification check.",
        good: "Mitigations exist; owners present; phase implied.",
        acceptable: "Mitigations described in prose without ownership.",
        poor: "Threats without mitigations, or \"monitor closely\" as the mitigation.",
      },
    },
    {
      id: "residual-risk",
      description: "Residual risk statement: what's explicitly accepted, why, and what's out of scope.",
      weight: 0.15,
      scoringGuide: {
        excellent: "Explicit accepted-risk list with business rationale; out-of-scope items named with reason.",
        good: "Residual risk stated; rationale partial.",
        acceptable: "\"Some risks remain\" without enumeration.",
        poor: "No residual-risk section; implies completeness it can't have.",
      },
    },
  ],
};
