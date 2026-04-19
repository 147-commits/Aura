/**
 * Pipeline agents — Virtual Company Engine roster.
 *
 * 12 agents across the org hierarchy (5 executives + 4 leads + 3 specialists).
 * Each is mounted on one or more PipelinePhase values; the orchestrator
 * (C3) selects per phase via getAgentsForPhase().
 *
 * Adding a pipeline agent:
 *   1. Create server/agents/pipeline/<id>.ts exporting the AgentDefinition
 *   2. Import + add to PIPELINE_AGENTS below
 *   3. The agent-registry's bulk-register loop picks it up automatically
 */

import type { AgentDefinition } from "../../../shared/agent-schema";
import { ceo } from "./ceo";
import { cto } from "./cto";
import { cpo } from "./cpo";
import { coo } from "./coo";
import { ciso } from "./ciso";
import { engLead } from "./eng-lead";
import { qaLead } from "./qa-lead";
import { designLead } from "./design-lead";
import { devopsLead } from "./devops-lead";
import { architect } from "./architect";
import { fullstackEng } from "./fullstack-eng";
import { techWriter } from "./tech-writer";

export const PIPELINE_AGENTS: AgentDefinition[] = [
  // Executives (5)
  ceo, cto, cpo, coo, ciso,
  // Leads (4)
  engLead, qaLead, designLead, devopsLead,
  // Specialists (3)
  architect, fullstackEng, techWriter,
];

export {
  ceo, cto, cpo, coo, ciso,
  engLead, qaLead, designLead, devopsLead,
  architect, fullstackEng, techWriter,
};
