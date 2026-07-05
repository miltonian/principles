import { Llm } from "../llm/gateway";
import { Truth, Subtask, CoverageMapRow, Observation, failures } from "../shared/types";
import { refine, RefineOutcome } from "../shared/refine";
import { judge } from "../shared/judge";
import { surveyLandscape } from "./survey";
import { deriveTruths } from "./truths";
import { vetTruths, VetResult } from "./skeptic";
import { decompose, DecompositionResult } from "./decompose";
import { coverageCritique } from "./coverage";
import { decompositionRubric } from "./rubric";

export interface Foundations {
  survey: Observation[];
  truths: Truth[];
  vet: VetResult;
  subtasks: Subtask[];
  coverageMap: CoverageMapRow[];
  decomposition: RefineOutcome<DecompositionResult>;
}

/** Render a decomposition candidate for judging — the judge must SEE the
 * coverage map (not just the subtasks) for d-breadth to be verifiable. */
function renderCandidate(d: DecompositionResult): string {
  return [
    ...d.subtasks.map(
      (s) =>
        `${s.id}: ${s.description} (serves: ${s.servesTruths.join(",")}; depends: ${s.dependsOn.join(",") || "none"}${
          s.needsWeb ? `; WEB REQUESTED: ${s.webJustification}` : ""
        })`
    ),
    ``,
    `Coverage map:`,
    ...d.coverageMap.map(
      (r) => `- ${r.dimension}: ${r.handledBy ? `handled by ${r.handledBy}` : `excluded — ${r.exclusionReason || "(no reason given)"}`}`
    ),
  ].join("\n");
}

/**
 * The shared front half of generation: derive typed truths, vet them
 * adversarially, and produce a coverage-checked, judge-approved decomposition.
 * Consumed by both generateOntology (which adds agent specs) and
 * compileRubric (which stops here).
 */
export async function deriveFoundations(llm: Llm, objective: string): Promise<Foundations> {
  const survey = await surveyLandscape(llm, objective);
  const derived = await deriveTruths(llm, objective, survey);
  const vet = await vetTruths(llm, objective, derived, survey);
  const truths = [...vet.kept, ...vet.assumptions];
  if (truths.length === 0) {
    throw new Error(
      `No truths survived vetting for objective "${objective}". ` +
        `Rejected: ${vet.rejected.map((r) => `${r.truth.statement} (${r.attack})`).join("; ")}`
    );
  }

  const rubric = decompositionRubric(truths);

  const decomposition = await refine<DecompositionResult>(
    (feedback) => decompose(llm, objective, truths, feedback),
    async (d) => {
      const mechanical = coverageCritique(truths, d.subtasks, d.coverageMap);
      if (failures(mechanical).length > 0) return mechanical;
      return judge(llm, {
        rubric,
        candidate: renderCandidate(d),
        context: `Objective: ${objective}\nTruths:\n${truths.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`).join("\n")}`,
      });
    },
    { maxIterations: 5 }
  );

  return {
    survey,
    truths,
    vet,
    subtasks: decomposition.result.subtasks,
    coverageMap: decomposition.result.coverageMap,
    decomposition,
  };
}
