import { Llm } from "../llm/gateway";
import { Truth, Subtask, CoverageMapRow, Observation, failures } from "../shared/types";
import { refine, RefineOutcome, RefineFeedback } from "../shared/refine";
import { judge } from "../shared/judge";
import { surveyLandscape } from "./survey";
import { deriveTruths } from "./truths";
import { vetTruths, VetResult } from "./skeptic";
import { decompose, DecompositionResult, renderCoverageRow } from "./decompose";
import { coverageCritique } from "./coverage";
import { decompositionRubric } from "./rubric";
import { challengeFrame, FrameChallenge } from "./frameSkeptic";

export interface Foundations {
  survey: Observation[];
  truths: Truth[];
  vet: VetResult;
  subtasks: Subtask[];
  coverageMap: CoverageMapRow[];
  decomposition: RefineOutcome<DecompositionResult>;
}

/** Render a decomposition candidate for judging — the judge must SEE the
 * coverage map (not just the subtasks) for d-breadth to be verifiable.
 * When frame challenges were raised, they must be SEEN too (blind-judge
 * lesson): d-breadth can only enforce adopt-or-exclude if the judge reads them. */
function renderCandidate(d: DecompositionResult, challenges: FrameChallenge[] = []): string {
  const lines = [
    ...d.subtasks.map(
      (s) =>
        `${s.id}: ${s.description} (serves: ${s.servesTruths.join(",")}; depends: ${s.dependsOn.join(",") || "none"}${
          s.needsWeb ? `; WEB REQUESTED: ${s.webJustification}` : ""
        })`
    ),
    ``,
    `Coverage map:`,
    ...d.coverageMap.map(renderCoverageRow),
  ];
  if (challenges.length > 0) {
    lines.push(
      ``,
      `Frame challenges raised (each must be adopted or excluded-with-reason):`,
      ...challenges.map((c) => `- ${c.id} [${c.kind}]: ${c.challenge}`)
    );
  }
  return lines.join("\n");
}

/** Frame summary for the frame skeptic: subtask descriptions and coverage-map
 * dimensions ONLY — never truths (see frameSkeptic.ts: judges get clean context). */
function buildFrameSummary(d: DecompositionResult): string {
  return [
    ...d.subtasks.map((s) => `- ${s.id}: ${s.description}`),
    ``,
    `Coverage map:`,
    ...d.coverageMap.map(renderCoverageRow),
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
  const truthsContext = `Objective: ${objective}\nTruths:\n${truths.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`).join("\n")}`;

  let decomposition = await refine<DecompositionResult>(
    (feedback) => decompose(llm, objective, truths, feedback),
    async (d) => {
      const mechanical = coverageCritique(truths, d.subtasks, d.coverageMap);
      if (failures(mechanical).length > 0) return mechanical;
      return judge(llm, {
        rubric,
        candidate: renderCandidate(d),
        context: truthsContext,
      });
    },
    { maxIterations: 5 }
  );

  // Frame-level skeptic (Lakatos pass): only once decomposition has a converged
  // frame to challenge. The skeptic sees the frame, not the truths — a
  // separate operation from truth-checking (see frameSkeptic.ts). Zero
  // challenges is a pass-through: no extra decomposition or judge call.
  if (decomposition.status === "converged") {
    const frameSummary = buildFrameSummary(decomposition.result);
    const challenges = await challengeFrame(llm, objective, survey, frameSummary);

    if (challenges.length > 0) {
      const frameFeedback: RefineFeedback<DecompositionResult> = {
        previous: decomposition.result,
        critique: {
          verdicts: challenges.map((c) => ({ criterionId: `frame-${c.id}`, pass: false, evidence: c.challenge })),
        },
      };

      // Exactly one revision through the existing decompose feedback path,
      // then re-run coverage + judge once — reusing refine() with
      // maxIterations 1 preserves the same converged/escalated/exhausted
      // status semantics the rest of the pipeline already relies on.
      const frameOutcome = await refine<DecompositionResult>(
        () => decompose(llm, objective, truths, frameFeedback),
        async (d) => {
          const mechanical = coverageCritique(truths, d.subtasks, d.coverageMap);
          if (failures(mechanical).length > 0) return mechanical;
          return judge(llm, {
            rubric,
            candidate: renderCandidate(d, challenges),
            context: truthsContext,
          });
        },
        { maxIterations: 1 }
      );

      const iterations = decomposition.iterations + frameOutcome.iterations;
      const history = [...decomposition.history, ...frameOutcome.history];
      decomposition =
        frameOutcome.status === "escalated"
          ? { status: "escalated", result: frameOutcome.result, iterations, history, stuckOn: frameOutcome.stuckOn }
          : { status: frameOutcome.status, result: frameOutcome.result, iterations, history };
    }
  }

  return {
    survey,
    truths,
    vet,
    subtasks: decomposition.result.subtasks,
    coverageMap: decomposition.result.coverageMap,
    decomposition,
  };
}
