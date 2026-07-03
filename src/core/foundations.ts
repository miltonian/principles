import { Llm } from "../llm/gateway";
import { Truth, Subtask, failures } from "../shared/types";
import { refine, RefineOutcome } from "../shared/refine";
import { judge } from "../shared/judge";
import { deriveTruths } from "./truths";
import { vetTruths, VetResult } from "./skeptic";
import { decompose } from "./decompose";
import { coverageCritique } from "./coverage";
import { decompositionRubric } from "./rubric";

export interface Foundations {
  truths: Truth[];
  vet: VetResult;
  subtasks: Subtask[];
  decomposition: RefineOutcome<Subtask[]>;
}

/**
 * The shared front half of generation: derive typed truths, vet them
 * adversarially, and produce a coverage-checked, judge-approved decomposition.
 * Consumed by both generateOntology (which adds agent specs) and
 * compileRubric (which stops here).
 */
export async function deriveFoundations(llm: Llm, objective: string): Promise<Foundations> {
  const derived = await deriveTruths(llm, objective);
  const vet = await vetTruths(llm, objective, derived);
  const truths = [...vet.kept, ...vet.assumptions];
  if (truths.length === 0) {
    throw new Error(
      `No truths survived vetting for objective "${objective}". ` +
        `Rejected: ${vet.rejected.map((r) => `${r.truth.statement} (${r.attack})`).join("; ")}`
    );
  }

  const rubric = decompositionRubric(truths);

  const decomposition = await refine<Subtask[]>(
    (feedback) => decompose(llm, objective, truths, feedback),
    async (subtasks) => {
      const mechanical = coverageCritique(truths, subtasks);
      if (failures(mechanical).length > 0) return mechanical;
      return judge(llm, {
        rubric,
        candidate: subtasks
          .map(
            (s) =>
              `${s.id}: ${s.description} (serves: ${s.servesTruths.join(",")}; depends: ${s.dependsOn.join(",") || "none"}${
                s.needsWeb ? `; WEB REQUESTED: ${s.webJustification}` : ""
              })`
          )
          .join("\n"),
        context: `Objective: ${objective}\nTruths:\n${truths.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`).join("\n")}`,
      });
    },
    { maxIterations: 5 }
  );

  return { truths, vet, subtasks: decomposition.result, decomposition };
}
