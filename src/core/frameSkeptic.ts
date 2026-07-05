import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Observation } from "../shared/types";

export type FrameChallengeKind = "missing-axis" | "wrong-genre" | "frame-misfit";

export interface FrameChallenge {
  id: string; // "fc1", "fc2", ...
  kind: FrameChallengeKind;
  challenge: string;
}

const FrameChallengeSchema = z.object({
  challenges: z.array(
    z.object({
      kind: z.enum(["missing-axis", "wrong-genre", "frame-misfit"]),
      challenge: z.string(),
    })
  ),
});

/**
 * Lakatos pass over the CHOSEN FRAME — deliberately not over the truths or
 * their derivation. Input is the objective, the landscape survey, and a
 * frame summary (subtask descriptions + coverage-map dimensions only); the
 * caller must never pass truths in (Cognition's "judges get clean context":
 * frame-checking is a separate operation from truth-checking; Gelman's
 * model-checking-is-separate principle). Tool-less: this is a judgment call
 * over text already in hand, not a research task.
 */
export async function challengeFrame(
  llm: Llm,
  objective: string,
  survey: Observation[],
  frameSummary: string
): Promise<FrameChallenge[]> {
  const result = await llm({
    system: [
      "You are an external skeptic reviewing a CHOSEN FRAME for decomposing an objective — not the objective's",
      "content, and not any derivation behind it. You are given only the objective, a landscape survey, and the",
      "frame itself (the subtasks it decomposed into and the dimensions it claims to cover or exclude).",
      "Challenge the frame directly:",
      "- missing-axis: a major axis of the topic (per the survey or your own judgment) has no subtask and is not",
      "  excluded in the coverage map.",
      "- wrong-genre: the frame does not match how this kind of deliverable is professionally practiced.",
      "- frame-misfit: the frame's basic shape does not fit the objective at all.",
      "Only raise challenges you can state concretely. If the frame is genuinely sound, return no challenges —",
      "manufacturing a challenge to have something to say is worse than silence.",
    ].join("\n"),
    prompt: [
      `## Objective`,
      objective,
      ``,
      `## Landscape survey`,
      survey.length > 0
        ? survey.map((o) => `- ${o.id} [${o.kind}] ${o.statement} (${o.source})`).join("\n")
        : "(no survey observations)",
      ``,
      `## Frame under review`,
      frameSummary,
    ].join("\n"),
    schema: FrameChallengeSchema,
    schemaName: "frame_challenges",
  });

  return result.challenges.map((c, i) => ({ id: `fc${i + 1}`, ...c }));
}
