import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Truth, Observation } from "../shared/types";

const AttackSchema = z.object({
  verdict: z.enum(["survives", "demote", "reject"]),
  strongestAttack: z.string(),
  justification: z.string(),
});

export interface VetResult {
  kept: Truth[];
  assumptions: Truth[]; // demoted — surfaced to the user as "proceeding as if"
  rejected: { truth: Truth; attack: string }[];
}

/**
 * Adversarial vetting: a dedicated skeptic tries to BREAK each truth.
 * In a text-only system this is the only available stand-in for reality
 * pushing back. Truths that survive are kept; unverifiable ones are demoted
 * to explicit assumptions; broken ones are rejected with the attack recorded.
 */
export async function vetTruths(
  llm: Llm,
  objective: string,
  truths: Truth[],
  survey?: Observation[]
): Promise<VetResult> {
  const result: VetResult = { kept: [], assumptions: [], rejected: [] };

  const surveySection =
    survey && survey.length > 0
      ? [
          ``,
          `## External observations (attack the truths WITH these in hand — and attack the observations themselves where they are weak)`,
          ...survey.map((o) => `${o.id} [${o.kind}] ${o.statement} (${o.source})`),
        ]
      : [];

  for (const truth of truths) {
    const attack = await llm({
      system: [
        "You are a skeptic. Your only job is to break the claim you are given:",
        "find a counterexample, a reading of the objective under which it is false,",
        "or a hidden assumption smuggled inside it. Do not be charitable.",
        "Verdicts:",
        "- survives: you genuinely could not break it.",
        "- demote: it may hold, but it is unverifiable — it is an assumption, not a truth.",
        "- reject: it is false, not required, or incoherent for this objective.",
      ].join("\n"),
      prompt: [
        `## Objective`,
        objective,
        ...surveySection,
        ``,
        `## Claim under attack (type: ${truth.type})`,
        truth.statement,
        ``,
        `Rationale offered: ${truth.rationale}`,
      ].join("\n"),
      schema: AttackSchema,
      schemaName: "truth_attack",
    });

    if (attack.verdict === "survives") {
      result.kept.push(truth);
    } else if (attack.verdict === "demote") {
      result.assumptions.push({ ...truth, type: "assumption" });
    } else {
      result.rejected.push({ truth, attack: attack.strongestAttack });
    }
  }
  return result;
}
