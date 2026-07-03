import { Llm } from "../llm/gateway";
import { Ontology, Subtask, failures } from "../shared/types";
import { refine, RefineOutcome } from "../shared/refine";
import { judge } from "../shared/judge";
import { deriveTruths } from "./truths";
import { vetTruths, VetResult } from "./skeptic";
import { decompose } from "./decompose";
import { coverageCritique } from "./coverage";
import { decompositionRubric, outputRubric } from "./rubric";
import { generateAgentSpecs } from "./specs";

export interface GenerationReport {
  ontology: Ontology;
  vet: VetResult;
  decomposition: RefineOutcome<Subtask[]>;
}

/**
 * derive → vet → refine(decompose ⇄ judge) → specs → ontology.
 * The decomposition judge is two-stage: mechanical coverage checks first
 * (free, deterministic); the LLM rubric judge only runs on structurally
 * sound candidates.
 */
export async function generateOntology(llm: Llm, objective: string): Promise<GenerationReport> {
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
          .map((s) => `${s.id}: ${s.description} (serves: ${s.servesTruths.join(",")}; depends: ${s.dependsOn.join(",") || "none"})`)
          .join("\n"),
        context: `Objective: ${objective}\nTruths:\n${truths.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`).join("\n")}`,
      });
    },
    { maxIterations: 5 }
  );

  const subtasks = decomposition.result;
  const agents = await generateAgentSpecs(llm, objective, truths, subtasks);

  return {
    ontology: {
      objective,
      truths: vet.kept,
      assumptions: vet.assumptions,
      subtasks,
      agents,
      outputRubric: outputRubric(truths),
    },
    vet,
    decomposition,
  };
}
