import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Ontology } from "../shared/types";
import { topoLevels } from "../shared/graph";
import { refine } from "../shared/refine";
import { judge } from "../shared/judge";
import { Blackboard, BlackboardEntry } from "./blackboard";
import { runAgent, AgentOutput } from "./agent";
import { plan } from "./planner";

const AnswerSchema = z.object({ answer: z.string() });

export interface RunResult {
  answer: string;
  planned: string[];
  escaped: boolean;
  board: BlackboardEntry[];
}

export async function runOntology(llm: Llm, ontology: Ontology, userPrompt: string): Promise<RunResult> {
  const triage = await plan(llm, ontology, userPrompt);

  if (!triage.fits) {
    // Escape hatch: never force a prompt through a frame that does not fit.
    const direct = await llm({
      system: `Answer the user's prompt directly and thoroughly. Context: this system was built for the objective "${ontology.objective}" but the prompt falls outside it (${triage.reason}).`,
      prompt: userPrompt,
      schema: AnswerSchema,
      schemaName: "direct_answer",
    });
    return { answer: direct.answer, planned: [], escaped: true, board: [] };
  }

  const board = new Blackboard();
  const levels = topoLevels(triage.agents.map((a) => ({ id: a.id, dependsOn: a.dependsOn })));
  if (!levels) throw new Error("Circular dependency among planned agents.");
  const specById = new Map(triage.agents.map((a) => [a.id, a]));

  for (const level of levels) {
    const outputs = await Promise.all(
      level.map(async (agentId) => {
        const spec = specById.get(agentId)!;
        const outcome = await refine<AgentOutput>(
          (feedback) =>
            runAgent(
              llm, spec, userPrompt, board,
              feedback
                ? feedback.critique.verdicts.filter((v) => !v.pass).map((v) => `${v.criterionId}: ${v.evidence}`).join("\n")
                : undefined
            ),
          (candidate) =>
            judge(llm, {
              rubric: ontology.outputRubric,
              candidate: `Result:\n${candidate.result}\n\nNotes:\n${candidate.notes}`,
              context: `Agent "${spec.name}" (${spec.instructions}) answering: ${userPrompt}`,
            }),
          { maxIterations: 3 }
        );
        return { spec, output: outcome.result };
      })
    );
    // Write after the level completes so same-level agents don't race on reads.
    for (const { spec, output } of outputs) {
      board.add({ agentId: spec.id, subtask: spec.instructions, notes: output.notes, result: output.result });
    }
  }

  const synthesis = await llm({
    system: [
      "You synthesize the final answer from the work on the blackboard.",
      "Use everything: results AND notes. Preserve nuance; surface disagreements between agents instead of papering over them.",
    ].join("\n"),
    prompt: [
      `## User prompt`,
      userPrompt,
      ``,
      `## Blackboard`,
      board.render(),
    ].join("\n"),
    schema: z.object({ answer: z.string() }),
    schemaName: "synthesis",
  });

  return {
    answer: synthesis.answer,
    planned: triage.agents.map((a) => a.id),
    escaped: false,
    board: board.all(),
  };
}
