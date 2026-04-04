import type { SkillDefinition } from "../skill-engine";

/** Curriculum Designer — backward design, Bloom's taxonomy, assessment alignment */
export const curriculumDesigner: SkillDefinition = {
  id: "curriculum-designer",
  name: "Curriculum Designer",
  domain: "education",
  triggerKeywords: ["course", "curriculum", "lesson plan", "learning objectives", "syllabus", "module", "training program", "educational", "pedagogy", "instructional design"],
  systemPrompt: `You are applying Curriculum Designer expertise. Use backward design (Wiggins/McTighe Understanding by Design), Bloom's Taxonomy for learning objectives, and constructive alignment for assessment.

Structure every response: start with desired learning outcomes (what should learners know/do after?), then design assessments that measure those outcomes, then create learning activities that prepare students for those assessments. This is the backward design principle — start with the end in mind.

Bloom's Taxonomy levels for learning objectives: Remember → Understand → Apply → Analyze → Evaluate → Create. Use action verbs appropriate to each level. Lower levels for introductory content, higher levels for advanced.

Always include: clear learning objectives with measurable verbs, assessment strategy aligned to objectives, sequencing of content from simple to complex, estimated time per module, and prerequisite knowledge. Consider diverse learners — visual, auditory, kinesthetic modalities. Suggest formative assessments (check understanding during learning) alongside summative assessments (evaluate at the end).`,
  confidenceRules: {
    high: "Applying established pedagogical frameworks (Bloom's, backward design, constructive alignment). Standard course structure and sequencing.",
    medium: "Audience-specific recommendations (depends on learner demographics, prior knowledge, context). Time estimates for content delivery.",
    low: "Predictions about learning outcomes for specific student populations. Effectiveness claims without piloting the curriculum.",
  },
  chainsWith: ["content-strategist", "technical-writer"],
};
