import type { EvalRubric, ArtifactType } from "../rubric-schema";
import { validateRubricWeights } from "../rubric-schema";
import { prdRubric } from "./prd-rubric";
import { adrRubric } from "./adr-rubric";
import { projectCharterRubric } from "./project-charter-rubric";
import { chatResponseRubric } from "./chat-response-rubric";
import { deliveryPlanRubric } from "./delivery-plan-rubric";
import { threatModelRubric } from "./threat-model-rubric";
import { sprintPlanRubric } from "./sprint-plan-rubric";
import { testStrategyRubric } from "./test-strategy-rubric";
import { designSpecRubric } from "./design-spec-rubric";
import { deploymentRunbookRubric } from "./deployment-runbook-rubric";
import { systemDesignRubric } from "./system-design-rubric";
import { codeChangeSetRubric } from "./code-change-set-rubric";
import { documentationSetRubric } from "./documentation-set-rubric";

export const ALL_RUBRICS: EvalRubric[] = [
  prdRubric,
  adrRubric,
  projectCharterRubric,
  chatResponseRubric,
  deliveryPlanRubric,
  threatModelRubric,
  sprintPlanRubric,
  testStrategyRubric,
  designSpecRubric,
  deploymentRunbookRubric,
  systemDesignRubric,
  codeChangeSetRubric,
  documentationSetRubric,
];

// Validate weights at module load — fail loud, fail early.
for (const r of ALL_RUBRICS) validateRubricWeights(r);

const RUBRICS_BY_TYPE: Record<ArtifactType, EvalRubric> = {
  prd: prdRubric,
  adr: adrRubric,
  "project-charter": projectCharterRubric,
  "chat-response": chatResponseRubric,
  "delivery-plan": deliveryPlanRubric,
  "threat-model": threatModelRubric,
  "sprint-plan": sprintPlanRubric,
  "test-strategy": testStrategyRubric,
  "design-spec": designSpecRubric,
  "deployment-runbook": deploymentRunbookRubric,
  "system-design": systemDesignRubric,
  "code-change-set": codeChangeSetRubric,
  "documentation-set": documentationSetRubric,
};

export function getRubric(type: ArtifactType): EvalRubric {
  return RUBRICS_BY_TYPE[type];
}

export {
  prdRubric,
  adrRubric,
  projectCharterRubric,
  chatResponseRubric,
  deliveryPlanRubric,
  threatModelRubric,
  sprintPlanRubric,
  testStrategyRubric,
  designSpecRubric,
  deploymentRunbookRubric,
  systemDesignRubric,
  codeChangeSetRubric,
  documentationSetRubric,
};
