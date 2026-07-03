import { Llm } from "../llm/gateway";
import { judge } from "../shared/judge";
import { Critique } from "../shared/types";
import { CompiledRubric } from "./rubricCompiler";

export const DIFF_CHAR_CAP = 120_000;
export const COMMENT_MARKER = "<!-- principles-evidence-judge -->";

export interface DiffJudgment {
  critique: Critique;
  truncated: boolean;
  rubricObjective: string;
  criteriaCount: number;
}

/** Frame the diff; truncate huge ones on a line boundary — loudly, never silently. */
export function buildCandidate(diff: string): { candidate: string; truncated: boolean } {
  const framing = "Unified git diff under review:\n\n";
  if (diff.length <= DIFF_CHAR_CAP) {
    return { candidate: framing + diff, truncated: false };
  }
  const cut = diff.lastIndexOf("\n", DIFF_CHAR_CAP);
  const kept = diff.slice(0, cut > 0 ? cut : DIFF_CHAR_CAP);
  return {
    candidate: `${framing}${kept}\n[diff truncated at ${kept.length} chars of ${diff.length}]`,
    truncated: true,
  };
}

/** Minimal shape validation with descriptive failures — no zod needed for a local file. */
export function loadRubricCriteria(rubricJson: unknown): CompiledRubric {
  const r = rubricJson as CompiledRubric;
  if (!r || typeof r !== "object" || typeof r.objective !== "string") {
    throw new Error("Invalid rubric file: expected a CompiledRubric with an 'objective' string. Regenerate with: yarn compile-rubric");
  }
  if (!Array.isArray(r.criteria) || r.criteria.length === 0) {
    throw new Error("Invalid rubric file: 'criteria' must be a non-empty array. Regenerate with: yarn compile-rubric");
  }
  for (const c of r.criteria) {
    if (typeof c.id !== "string" || typeof c.description !== "string") {
      throw new Error("Invalid rubric file: every criterion needs string 'id' and 'description'. Regenerate with: yarn compile-rubric");
    }
  }
  return r;
}

export async function judgeDiff(llm: Llm, diff: string, rubric: CompiledRubric): Promise<DiffJudgment> {
  const { candidate, truncated } = buildCandidate(diff);
  const judgedRubric = rubric.criteria.map((c) => ({
    ...c,
    description: c.evidenceGuidance
      ? `${c.description} — Evidence required: ${c.evidenceGuidance}`
      : c.description,
  }));
  const critique = await judge(llm, {
    rubric: judgedRubric,
    candidate,
    context: [
      `You are reviewing a code change to the Principles framework repository.`,
      `Rubric objective: ${rubric.objective}`,
      `Evidence MUST cite concrete file paths and hunks from the diff itself.`,
    ].join("\n"),
  });
  return { critique, truncated, rubricObjective: rubric.objective, criteriaCount: rubric.criteria.length };
}

const escapeCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/** Pure markdown rendering — marker first so CI can upsert the comment. */
export function renderVerdictTable(j: DiffJudgment): string {
  const lines = [
    COMMENT_MARKER,
    `### Evidence judge (advisory)`,
    ``,
    `Graded against: *${j.rubricObjective}* (${j.criteriaCount} criteria). This comment never blocks merge.`,
    ``,
    ...(j.truncated ? [`> ⚠️ The diff exceeded ${DIFF_CHAR_CAP} chars and was truncated before judging.`, ``] : []),
    `| criterion | verdict | evidence |`,
    `|---|---|---|`,
    ...j.critique.verdicts.map(
      (v) => `| \`${v.criterionId}\` | ${v.pass ? "✅ PASS" : "❌ FAIL"} | ${escapeCell(v.evidence)} |`
    ),
  ];
  return lines.join("\n") + "\n";
}
