import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Truth, Observation } from "../shared/types";

const TruthsSchema = z.object({
  truths: z.array(
    z.object({
      type: z.enum(["fact", "assumption", "constraint", "definition"]),
      statement: z.string(),
      rationale: z.string(),
      groundedIn: z.array(z.string()),
    })
  ),
});

const renderObservation = (o: Observation): string => `${o.id} [${o.kind}] ${o.statement} (${o.source})`;

/**
 * Derive TYPED truths. The type forces the model to commit to what kind of
 * claim it is making — that commitment is what downstream stages check.
 *
 * When a landscape survey is supplied, its observations are rendered as
 * candidate evidence — never premises — that truths may cite via groundedIn.
 */
export async function deriveTruths(llm: Llm, objective: string, survey?: Observation[]): Promise<Truth[]> {
  const surveySection =
    survey && survey.length > 0
      ? [
          ``,
          `## CANDIDATE OBSERVATIONS (evidence, not premises — reject freely, cite if used)`,
          ...survey.map(renderObservation),
        ]
      : [];

  const result = await llm({
    system: [
      "You derive the fundamental truths underlying a user objective.",
      "Every truth must be a single, falsifiable claim — stated so that it COULD be wrong.",
      "Restating the objective is not a truth. Each truth must be typed:",
      "- fact: checkable against the world or the user's own words.",
      "- assumption: something you cannot verify and are choosing to proceed on. Be honest about these.",
      "- constraint: a rule every valid solution must obey.",
      "- definition: vocabulary that must be used consistently.",
      "",
      "Derive truths about TWO subjects: the topic itself, AND the deliverable the objective asks for. For the deliverable, ask: what KIND of artifact is this (report, design doc, creator kit, outline, story, brief)? What parts does that kind of artifact ALWAYS contain in professional practice? What register and audience does it imply? State these as constraint truths about the deliverable (e.g. \"The deliverable is a video-creator kit; such kits include a shot-by-shot script, a title, and platform furniture — and casual register: academic citation style is out of place\").",
      "",
      "Prefer fewer, sharper truths over many vague ones.",
      "",
      "groundedIn lists the observation ids a truth rests on; empty for truths derived by reasoning alone.",
    ].join("\n"),
    prompt: [`## User objective`, objective, ...surveySection, ``, `Derive the typed fundamental truths.`].join("\n"),
    schema: TruthsSchema,
    schemaName: "typed_truths",
  });

  return result.truths.map((t, i) => ({ id: `t${i + 1}`, ...t, groundedIn: t.groundedIn ?? [] }));
}
