import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Truth } from "../shared/types";

const TruthsSchema = z.object({
  truths: z.array(
    z.object({
      type: z.enum(["fact", "assumption", "constraint", "definition"]),
      statement: z.string(),
      rationale: z.string(),
    })
  ),
});

/**
 * Derive TYPED truths. The type forces the model to commit to what kind of
 * claim it is making — that commitment is what downstream stages check.
 */
export async function deriveTruths(llm: Llm, objective: string): Promise<Truth[]> {
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
    ].join("\n"),
    prompt: `## User objective\n${objective}\n\nDerive the typed fundamental truths.`,
    schema: TruthsSchema,
    schemaName: "typed_truths",
  });

  return result.truths.map((t, i) => ({ id: `t${i + 1}`, ...t }));
}
