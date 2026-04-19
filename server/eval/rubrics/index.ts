import type { EvalRubric, ArtifactType } from "../rubric-schema";
import { validateRubricWeights } from "../rubric-schema";
import { prdRubric } from "./prd-rubric";
import { adrRubric } from "./adr-rubric";
import { projectCharterRubric } from "./project-charter-rubric";
import { chatResponseRubric } from "./chat-response-rubric";

export const ALL_RUBRICS: EvalRubric[] = [
  prdRubric,
  adrRubric,
  projectCharterRubric,
  chatResponseRubric,
];

// Validate weights at module load — fail loud, fail early.
for (const r of ALL_RUBRICS) validateRubricWeights(r);

const RUBRICS_BY_TYPE: Record<ArtifactType, EvalRubric> = {
  prd: prdRubric,
  adr: adrRubric,
  "project-charter": projectCharterRubric,
  "chat-response": chatResponseRubric,
};

export function getRubric(type: ArtifactType): EvalRubric {
  return RUBRICS_BY_TYPE[type];
}

export { prdRubric, adrRubric, projectCharterRubric, chatResponseRubric };
