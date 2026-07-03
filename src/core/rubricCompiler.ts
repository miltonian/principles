import { Truth, Subtask, Criterion } from "../shared/types";
import { z } from "zod";
import { Llm } from "../llm/gateway";

export interface CompiledCriterion extends Criterion {
  subtaskId?: string;
  evidenceGuidance: string;
}

export interface CompiledRubric {
  objective: string;
  criteria: CompiledCriterion[];
  truths: Truth[];
  assumptions: Truth[];
  rejectedTruths: { statement: string; attack: string }[];
  gradeability: { status: string; iterations: number };
  generatedAt: string;
  model: string;
}

/**
 * Draft criteria from three provenanced sources. Structure is code-derived;
 * only evidence guidance and meta-check revisions involve the model.
 */
export function draftCriteria(truths: Truth[], subtasks: Subtask[]): CompiledCriterion[] {
  const generic: CompiledCriterion[] = [
    {
      id: "c-responsive",
      source: "generic",
      description: "The deliverable directly addresses the stated objective — not a generic treatment near the topic.",
      evidenceGuidance: "",
    },
    {
      id: "c-grounded",
      source: "generic",
      description: "Claims in the deliverable are grounded in provided material or clearly flagged as uncertain; nothing is fabricated.",
      evidenceGuidance: "",
    },
  ];

  const hardConstraints: CompiledCriterion[] = truths
    .filter((t) => t.type === "constraint")
    .map((t) => ({
      id: `c-${t.id}`,
      source: "truth" as const,
      truthId: t.id,
      description: `The deliverable satisfies the constraint: "${t.statement}"`,
      evidenceGuidance: "",
    }));

  const completeness: CompiledCriterion[] = subtasks.map((s) => ({
    id: `c-${s.id}`,
    source: "subtask" as const,
    subtaskId: s.id,
    description: `The deliverable adequately addresses: ${s.description}`,
    evidenceGuidance: "",
  }));

  return [...generic, ...hardConstraints, ...completeness];
}

const GuidanceSchema = z.object({
  guidance: z.array(
    z.object({
      criterionId: z.string(),
      evidenceGuidance: z.string(),
    })
  ),
});

export const DEFAULT_EVIDENCE_GUIDANCE =
  "Cite the specific passage(s) of the deliverable that satisfy this criterion.";

/**
 * One batched call: per-criterion guidance on what evidence a grader must
 * see before passing it. Mechanical spine in code: skipped criteria get a
 * safe default (never blocks compilation), unknown ids are dropped.
 */
export async function addEvidenceGuidance(
  llm: Llm,
  objective: string,
  criteria: CompiledCriterion[]
): Promise<CompiledCriterion[]> {
  const raw = await llm({
    system: [
      "You write evidence requirements for rubric criteria used by a strict grader.",
      "For each criterion, state concretely what a grader must find in a deliverable",
      "before marking it passed — observable, citable evidence, not vibes.",
      "One entry per criterion, using the exact criterionIds given.",
    ].join("\n"),
    prompt: [
      `## Objective the rubric grades against`,
      objective,
      ``,
      `## Criteria`,
      ...criteria.map((c) => `- ${c.id}: ${c.description}`),
    ].join("\n"),
    schema: GuidanceSchema,
    schemaName: "rubric_guidance",
  });

  const byId = new Map(raw.guidance.map((g) => [g.criterionId, g.evidenceGuidance]));
  return criteria.map((c) => ({
    ...c,
    evidenceGuidance: byId.get(c.id)?.trim() || DEFAULT_EVIDENCE_GUIDANCE,
  }));
}
