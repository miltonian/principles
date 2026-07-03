import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Truth, Subtask, failures } from "../shared/types";
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
});

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
  feedback: RefineFeedback<Subtask[]> | null
): Promise<Subtask[]> {
  const feedbackSection = feedback
    ? [
        ``,
        `## Previous attempt (REVISE this — do not start over)`,
        ...feedback.previous.map((s) => `- ${s.id}: ${s.description} (serves: ${s.servesTruths.join(",")}; depends: ${s.dependsOn.join(",") || "none"})`),
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

  return result.subtasks.map((s, i) => ({
    id: `s${i + 1}`,
    description: s.description,
    servesTruths: s.servesTruths,
    dependsOn: s.dependsOnIndices.map((n) =>
      n >= 1 && n <= result.subtasks.length && n !== i + 1 ? `s${n}` : `invalid:${n}`
    ),
    needsWeb: s.needsWeb,
    webJustification: s.webJustification.trim(),
  }));
}
