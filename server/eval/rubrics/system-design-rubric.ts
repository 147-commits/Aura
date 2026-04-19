import type { EvalRubric } from "../rubric-schema";

export const systemDesignRubric: EvalRubric = {
  id: "system-design-v1",
  name: "System Design Document Rubric",
  artifactType: "system-design",
  criteria: [
    {
      id: "bounded-contexts",
      description: "Bounded contexts identified with ubiquitous language; context relationships named.",
      weight: 0.20,
      scoringGuide: {
        excellent: "Contexts enumerated; per-context glossary; relationships (shared kernel, customer-supplier, anticorruption layer) labelled.",
        good: "Contexts named; relationships partial.",
        acceptable: "Contexts implied not labelled.",
        poor: "No DDD framing; treats system as a single domain.",
      },
    },
    {
      id: "component-contracts",
      description: "Contracts between components: request/response shape, errors, idempotency, retry semantics.",
      weight: 0.22,
      scoringGuide: {
        excellent: "Every component-to-component edge has full contract with errors + idempotency + retry behavior.",
        good: "Contracts present; errors or retry semantics partial.",
        acceptable: "Happy-path contracts; failure modes implicit.",
        poor: "Components named without contracts.",
      },
    },
    {
      id: "data-ownership",
      description: "Source-of-truth statement per entity: which component owns it, who reads vs writes.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Every entity has named owner; read/write flow explicit; cross-context reads use anticorruption layers.",
        good: "Most entities owned; one or two ambiguous.",
        acceptable: "Ownership implied by component names.",
        poor: "Multiple components claim ownership; no source of truth.",
      },
    },
    {
      id: "scaling-and-failure",
      description: "Per-component scaling pattern + per-external-dep failure mode and recovery.",
      weight: 0.22,
      scoringGuide: {
        excellent: "Each component has scaling story (vertical → horizontal → shard); each external dep has failure mode + recovery (retry+backoff+jitter, circuit breaker, fallback).",
        good: "Scaling and failure modes addressed; recovery partial.",
        acceptable: "Scaling discussed in prose; failure modes implicit.",
        poor: "No scaling story; \"happy path only\".",
      },
    },
    {
      id: "consistency-honesty",
      description: "\"Eventually consistent\" components state the user-observable staleness window.",
      weight: 0.18,
      scoringGuide: {
        excellent: "Every async/eventual boundary names the observable staleness window and the UX implication.",
        good: "Staleness windows for most async edges.",
        acceptable: "Mentions consistency model without windows.",
        poor: "Hand-waves \"eventually consistent\" without a window.",
      },
    },
  ],
};
