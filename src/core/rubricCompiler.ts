import { Truth, Subtask, Criterion } from "../shared/types";

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
