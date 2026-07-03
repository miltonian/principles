import { Llm } from "../llm/gateway";
import { Ontology, Subtask } from "../shared/types";
import { RefineOutcome } from "../shared/refine";
import { VetResult } from "./skeptic";
import { outputRubric } from "./rubric";
import { generateAgentSpecs } from "./specs";
import { deriveFoundations } from "./foundations";

export interface GenerationReport {
  ontology: Ontology;
  vet: VetResult;
  decomposition: RefineOutcome<Subtask[]>;
}

/**
 * deriveFoundations (derive → vet → refine-with-coverage) + agent specs +
 * ontology assembly. See src/core/foundations.ts for the shared front half.
 */
export async function generateOntology(llm: Llm, objective: string): Promise<GenerationReport> {
  const f = await deriveFoundations(llm, objective);
  const agents = await generateAgentSpecs(llm, objective, f.truths, f.subtasks);

  return {
    ontology: {
      objective,
      truths: f.vet.kept,
      assumptions: f.vet.assumptions,
      subtasks: f.subtasks,
      agents,
      outputRubric: outputRubric(f.truths),
    },
    vet: f.vet,
    decomposition: f.decomposition,
  };
}
