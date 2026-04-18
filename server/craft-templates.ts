/**
 * Craft Templates — starter templates for common craft types.
 * Shown in the empty state of the Crafts tab as suggestion chips.
 */

export interface CraftTemplate {
  id: string;
  name: string;
  kind: string;
  description: string;
  prompt: string;
  icon: string;
}

export const CRAFT_TEMPLATES: CraftTemplate[] = [
  {
    id: "resume",
    name: "Professional Resume",
    kind: "docx",
    description: "Clean, ATS-friendly resume document",
    prompt: "Write me a professional resume. Ask me for my details.",
    icon: "document-text-outline",
  },
  {
    id: "proposal",
    name: "Project Proposal",
    kind: "pdf",
    description: "Structured proposal with goals, timeline, budget",
    prompt: "Help me write a project proposal. Ask me about the project.",
    icon: "clipboard-outline",
  },
  {
    id: "pitch-deck",
    name: "Pitch Deck",
    kind: "pptx",
    description: "10-slide investor pitch presentation",
    prompt: "Create a pitch deck for my startup. Ask me about my company.",
    icon: "easel-outline",
  },
  {
    id: "budget",
    name: "Budget Tracker",
    kind: "xlsx",
    description: "Monthly budget with categories and totals",
    prompt: "Create a budget tracker spreadsheet for me. Ask me about my income and expenses.",
    icon: "bar-chart-outline",
  },
  {
    id: "landing-page",
    name: "Landing Page",
    kind: "html",
    description: "Beautiful landing page with Tailwind CSS",
    prompt: "Build me a landing page. Ask me about my product.",
    icon: "globe-outline",
  },
];

export function getTemplates(): CraftTemplate[] {
  return CRAFT_TEMPLATES;
}
