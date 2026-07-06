import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Observation } from "../shared/types";

export type { Observation };

const SurveySchema = z.object({
  observations: z.array(
    z.object({
      kind: z.enum(["genre-convention", "topic-axis"]),
      statement: z.string(),
      source: z.string(),
    })
  ),
});

/**
 * Survey the real-world landscape BEFORE any truths are derived. Two
 * questions only: what does this deliverable's genre professionally contain
 * (as practiced, with sources); what major axes does the world's treatment
 * of this topic span. Output is evidence, not premises — deriveTruths may
 * cite these observations, and the skeptic may reject any of them exactly
 * like a derived truth.
 *
 * The one sanctioned generation-side web call (CLAUDE.md invariant 1):
 * everything else in generation stays tool-less.
 */
export async function surveyLandscape(llm: Llm, objective: string): Promise<Observation[]> {
  const result = await llm({
    system: [
      "You survey the real-world landscape around a user objective — you do not answer the objective itself.",
      "Answer exactly two questions, each producing sourced, checkable observations:",
      "1. What does this deliverable's GENRE professionally contain, as actually practiced? (kind: genre-convention)",
      "2. What major axes does the world's treatment of this TOPIC span? (kind: topic-axis)",
      "Every statement must be checkable and must cite a source: a publication, outlet, convention, or documented",
      "body of practice — not a vibe or a guess. These are candidate observations for later stages to accept or",
      "reject; they are evidence, not conclusions, so do not draft or imply a solution.",
    ].join("\n"),
    prompt: `## User objective\n${objective}\n\nSurvey the landscape.`,
    schema: SurveySchema,
    schemaName: "landscape_survey",
    webTools: true,
  });

  return result.observations.map((o, i) => ({ id: `obs${i + 1}`, ...o }));
}
