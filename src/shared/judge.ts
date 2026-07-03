import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Criterion, Critique, CriterionVerdict } from "./types";

const VerdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      criterionId: z.string(),
      pass: z.boolean(),
      evidence: z.string(),
    })
  ),
});

const MIN_EVIDENCE_CHARS = 10;

/**
 * Rubric judge. The prompt leans against sycophancy (default-insufficient,
 * criterion-by-criterion, quote evidence); the code enforces what the prompt
 * can only request: skipped criteria fail, unevidenced passes fail.
 */
export async function judge(
  llm: Llm,
  args: { rubric: Criterion[]; candidate: string; context: string }
): Promise<Critique> {
  const { rubric, candidate, context } = args;

  const raw = await llm({
    system: [
      "You are a strict evaluator. Your default position is that the candidate is INSUFFICIENT;",
      "a criterion only passes if you can argue it passes by pointing at specific content.",
      "Evaluate every criterion independently, one at a time.",
      "For each verdict, `evidence` must quote or precisely reference the part of the candidate",
      "that justifies the verdict. Unsupported praise is worthless.",
    ].join("\n"),
    prompt: [
      `## Context`,
      context,
      ``,
      `## Candidate under evaluation`,
      candidate,
      ``,
      `## Rubric — return one verdict per criterion, using these exact criterionIds`,
      ...rubric.map((c) => `- ${c.id}: ${c.description}`),
    ].join("\n"),
    schema: VerdictsSchema,
    schemaName: "rubric_verdicts",
  });

  const byId = new Map(raw.verdicts.map((v) => [v.criterionId, v]));
  const verdicts: CriterionVerdict[] = rubric.map((c) => {
    const v = byId.get(c.id);
    if (!v) return { criterionId: c.id, pass: false, evidence: "Criterion not evaluated by judge." };
    if (v.pass && v.evidence.trim().length < MIN_EVIDENCE_CHARS) {
      return { criterionId: c.id, pass: false, evidence: "Pass verdict rejected: no evidence provided." };
    }
    return v;
  });

  return { verdicts };
}
