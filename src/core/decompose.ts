import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Truth, Subtask, CoverageMapRow, failures } from "../shared/types";
import { RefineFeedback } from "../shared/refine";

const DecompositionSchema = z.object({
  subtasks: z.array(
    z.object({
      description: z.string(),
      servesTruths: z.array(z.string()),
      dependsOnIndices: z.array(z.number().int()), // 1-based index into this same list
      needsWeb: z.boolean(),
      webJustification: z.string(),
    })
  ),
  coverageMap: z.array(
    z.object({
      dimension: z.string(),
      handledBy: z.string(), // 1-based index (as text) into subtasks, or "" if excluded
      exclusionReason: z.string(),
    })
  ),
});

/** Result of one decomposition attempt: subtasks plus the explicit breadth map. */
export interface DecompositionResult {
  subtasks: Subtask[];
  coverageMap: CoverageMapRow[];
}

/** Map a model-cited 1-based index (as text) to a real subtask id, mirroring dependsOnIndices. */
function mapHandledBy(raw: string, subtaskCount: number): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 1 && n <= subtaskCount ? `s${n}` : `invalid:${trimmed}`;
}

export const renderCoverageRow = (r: CoverageMapRow): string =>
  `- ${r.dimension}: ${r.handledBy ? `handled by ${r.handledBy}` : `excluded — ${r.exclusionReason || "(no reason given)"}`}`;

/**
 * Decompose the objective into subtasks that CITE the truths they serve.
 * With feedback, this is a revision, not a re-roll: the previous attempt,
 * the failed criteria (with evidence), and what passed (to preserve) all
 * go into the prompt.
 */
export async function decompose(
  llm: Llm,
  objective: string,
  truths: Truth[],
  feedback: RefineFeedback<DecompositionResult> | null
): Promise<DecompositionResult> {
  const feedbackSection = feedback
    ? [
        ``,
        `## Previous attempt (REVISE this — do not start over)`,
        ...feedback.previous.subtasks.map(
          (s) =>
            `- ${s.id}: ${s.description} (serves: ${s.servesTruths.join(",")}; depends: ${s.dependsOn.join(",") || "none"}${
              s.needsWeb ? `; WEB REQUESTED: ${s.webJustification}` : ""
            })`
        ),
        ``,
        `## Previous coverage map`,
        ...feedback.previous.coverageMap.map(renderCoverageRow),
        ``,
        `## What failed — fix exactly these`,
        ...failures(feedback.critique).map((v) => `- ${v.criterionId}: ${v.evidence}`),
        ``,
        `## What passed — PRESERVE these properties`,
        ...feedback.critique.verdicts.filter((v) => v.pass).map((v) => `- ${v.criterionId}: ${v.evidence}`),
      ]
    : [];

  const result = await llm({
    system: [
      "You decompose an objective into minimal subtasks for text-only LLM agents.",
      "Rules:",
      "- Each subtask is one atomic action: analyze, summarize, draft, evaluate, reason.",
      "- No physical actions, no external API calls, no 'submit to' external systems.",
      "- Each subtask MUST cite the ids of the truths it serves (servesTruths).",
      "  If you cannot say which truth a subtask serves, the subtask does not belong.",
      "- dependsOnIndices: 1-based positions of subtasks whose OUTPUT this one needs.",
      "- needsWeb: set true ONLY when the subtask must fetch or search EXTERNAL material that the",
      "  user's prompt cannot be assumed to contain (e.g. retrieving a linked study). When true,",
      "  webJustification must concretely name what external material and why it is needed;",
      "  when false, webJustification is an empty string.",
      "- First enumerate the major dimensions an expert, comprehensive treatment of this topic",
      "  would cover — the survey instinct. Every dimension must be handled by a subtask or",
      "  explicitly excluded with a reason. Silent narrowing is the failure mode you exist to prevent.",
      "- coverageMap: one row per dimension. handledBy is the 1-based index (as text) of the subtask",
      "  that handles it, or an empty string if the dimension is excluded; exclusionReason must be",
      "  non-empty when handledBy is empty, and empty when handledBy is set.",
    ].join("\n"),
    prompt: [
      `## Objective`,
      objective,
      ``,
      `## Truths (cite these ids in servesTruths)`,
      ...truths.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`),
      ``,
      ...feedbackSection,
    ].join("\n"),
    schema: DecompositionSchema,
    schemaName: "decomposition",
  });

  const subtasks: Subtask[] = result.subtasks.map((s, i) => ({
    id: `s${i + 1}`,
    description: s.description,
    servesTruths: s.servesTruths,
    dependsOn: s.dependsOnIndices.map((n) =>
      n >= 1 && n <= result.subtasks.length && n !== i + 1 ? `s${n}` : `invalid:${n}`
    ),
    needsWeb: s.needsWeb,
    webJustification: s.webJustification.trim(),
  }));

  const coverageMap: CoverageMapRow[] = result.coverageMap.map((r) => ({
    dimension: r.dimension,
    handledBy: mapHandledBy(r.handledBy, result.subtasks.length),
    exclusionReason: r.exclusionReason.trim(),
  }));

  return { subtasks, coverageMap };
}
