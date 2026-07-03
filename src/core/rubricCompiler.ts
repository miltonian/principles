import { Truth, Subtask, Criterion, failures } from "../shared/types";
import { z } from "zod";
import { Llm } from "../llm/gateway";
import { refine, RefineFeedback } from "../shared/refine";
import { judge } from "../shared/judge";
import { deriveFoundations } from "./foundations";

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

/** Falsifiability applied to the rubric itself: the meta-criteria a rubric must pass. */
export const META_RUBRIC: Criterion[] = [
  {
    id: "m-gradeable",
    source: "generic",
    description:
      "Each criterion can be marked pass/fail by pointing at evidence in a deliverable, without information the grader will not have.",
  },
  {
    id: "m-independent",
    source: "generic",
    description: "Criteria do not substantially overlap; no deliverable property is double-counted.",
  },
  {
    id: "m-scoped",
    source: "generic",
    description: "No criterion demands work outside the objective's scope.",
  },
];

/** Pure render of criteria for judging and for the markdown renderer's body. */
export function renderCriteriaForJudging(criteria: CompiledCriterion[]): string {
  return criteria
    .map((c) => `- [${c.id}] ${c.description}\n  Evidence required: ${c.evidenceGuidance}`)
    .join("\n");
}

const RevisionSchema = z.object({
  criteria: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      evidenceGuidance: z.string(),
    })
  ),
});

/**
 * Revision call for the meta-check loop. The model may reword descriptions
 * and guidance and may DROP criteria; it may never add. Provenance fields
 * are re-attached from the current criteria in code. A revision containing
 * unknown ids is discarded wholesale (returning `current`) — silently
 * filtering would be a silent bless.
 */
export async function reviseCriteria(
  llm: Llm,
  objective: string,
  current: CompiledCriterion[],
  feedback: RefineFeedback<CompiledCriterion[]>
): Promise<CompiledCriterion[]> {
  const failed = failures(feedback.critique);
  const raw = await llm({
    system: [
      "You revise a grading rubric's criteria to fix specific meta-level failures.",
      "You may reword descriptions and evidence guidance, and you may REMOVE criteria",
      "(e.g. to fix overlap). You may NOT invent new criteria or new ids.",
      "Return the full revised criteria list.",
    ].join("\n"),
    prompt: [
      `## Objective the rubric grades against`,
      objective,
      ``,
      `## Current criteria`,
      renderCriteriaForJudging(current),
      ``,
      `## Meta-failures to fix (with evidence)`,
      ...failed.map((v) => `- ${v.criterionId}: ${v.evidence}`),
      ``,
      `## Passing meta-criteria — preserve these properties`,
      ...feedback.critique.verdicts.filter((v) => v.pass).map((v) => `- ${v.criterionId}: ${v.evidence}`),
    ].join("\n"),
    schema: RevisionSchema,
    schemaName: "rubric_revision",
  });

  const currentById = new Map(current.map((c) => [c.id, c]));
  const unknown = raw.criteria.filter((r) => !currentById.has(r.id));
  if (unknown.length > 0 || raw.criteria.length === 0) {
    return current; // discarded — refine's repeat-failure escalation will terminate
  }
  return raw.criteria.map((r) => ({
    ...currentById.get(r.id)!, // provenance (source/truthId/subtaskId) from code, not the model
    description: r.description,
    evidenceGuidance: r.evidenceGuidance,
  }));
}

/** Run the rubric through refine() against META_RUBRIC. Never silently bless. */
export async function gradeabilityCheck(
  llm: Llm,
  objective: string,
  criteria: CompiledCriterion[]
): Promise<{ criteria: CompiledCriterion[]; status: string; iterations: number }> {
  const outcome = await refine<CompiledCriterion[]>(
    async (feedback) => (feedback ? reviseCriteria(llm, objective, feedback.previous, feedback) : criteria),
    (candidate) =>
      judge(llm, {
        rubric: META_RUBRIC,
        candidate: renderCriteriaForJudging(candidate),
        context: `This is a grading rubric for the objective: ${objective}. Judge the RUBRIC itself, not any deliverable.`,
      }),
    { maxIterations: 3 }
  );
  return { criteria: outcome.result, status: outcome.status, iterations: outcome.iterations };
}

/**
 * The compile-rubric product: foundations (derive → skeptic → judged
 * decomposition) → provenanced draft criteria → batched evidence guidance →
 * gradeability meta-check. Stops before agent-spec generation.
 */
export async function compileRubric(
  llm: Llm,
  objective: string,
  now: () => Date = () => new Date()
): Promise<CompiledRubric> {
  const f = await deriveFoundations(llm, objective);
  const drafted = draftCriteria(f.truths, f.subtasks);
  const guided = await addEvidenceGuidance(llm, objective, drafted);
  const checked = await gradeabilityCheck(llm, objective, guided);

  return {
    objective,
    criteria: checked.criteria,
    truths: f.vet.kept,
    assumptions: f.vet.assumptions,
    rejectedTruths: f.vet.rejected.map((r) => ({ statement: r.truth.statement, attack: r.attack })),
    gradeability: { status: checked.status, iterations: checked.iterations },
    generatedAt: now().toISOString(),
    model: "claude-opus-4-8",
  };
}
