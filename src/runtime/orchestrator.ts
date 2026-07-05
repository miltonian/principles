import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Ontology, Criterion } from "../shared/types";
import { topoLevels } from "../shared/graph";
import { refine } from "../shared/refine";
import { judge } from "../shared/judge";
import { Blackboard, BlackboardEntry } from "./blackboard";
import { runAgent, AgentOutput } from "./agent";
import { plan } from "./planner";
import { buildContract, renderContract } from "./contract";
import { runGates } from "./renderGuard";

const AnswerSchema = z.object({ answer: z.string() });

export interface RunResult {
  answer: string;
  planned: string[];
  escaped: boolean;
  board: BlackboardEntry[];
  // Ids of agents whose refine loop did not converge (escalated/exhausted): their
  // board entries are retained but were never rubric-verified. May also contain
  // the literal "synthesis" when the final deliverable itself never converged
  // (its best candidate still ships — see the synthesis refine loop below).
  unverified: string[];
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
    return { answer: direct.answer, planned: [], escaped: true, board: [], unverified: [] };
  }

  const board = new Blackboard();
  const levels = topoLevels(triage.agents.map((a) => ({ id: a.id, dependsOn: a.dependsOn })));
  if (!levels) throw new Error("Circular dependency among planned agents.");
  const specById = new Map(triage.agents.map((a) => [a.id, a]));
  const unverified: string[] = [];

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
              // Scope truth-derived criteria to the truths THIS agent's subtask
              // cites (the citation graph exists for exactly this): judging one
              // agent's partial output against whole-objective constraints fails
              // every agent on criteria that belong to its siblings' subtasks.
              rubric: ontology.outputRubric.filter(
                (c) => c.source !== "truth" || (c.truthId !== undefined && spec.servesTruths.includes(c.truthId))
              ),
              candidate: `Result:\n${candidate.result}\n\nNotes:\n${candidate.notes}`,
              context: `Agent "${spec.name}" (${spec.instructions}) answering: ${userPrompt}`,
            }),
          { maxIterations: 3 }
        );
        return { spec, output: outcome.result, converged: outcome.status === "converged" };
      })
    );
    // Write after the level completes so same-level agents don't race on reads.
    for (const { spec, output, converged } of outputs) {
      board.add({ agentId: spec.id, subtask: spec.instructions, notes: output.notes, result: output.result });
      if (!converged) unverified.push(spec.id);
    }
  }

  const contract = buildContract(triage.deliverableGenre, triage.deliverableAudience, triage.agents, board.all());

  const contractCriteria: Criterion[] = [
    { id: "c-contract-genre", source: "generic", description: `The deliverable is a ${contract.genre} for ${contract.audience}, written as a standalone finished document.` },
    { id: "c-contract-sections", source: "generic", description: `The deliverable substantively covers every outline item: ${contract.sections.map((s) => s.title).join("; ")}.` },
    { id: "c-contract-clean", source: "generic", description: `No internal-process narration (agents, workspaces, roles); verification caveats appear only in a short closing "Verification notes" section.` },
  ];

  const synthesisOutcome = await refine<{ answer: string }>(
    (feedback) =>
      llm({
        system: `You are the author of the final deliverable.`,
        prompt: [
          `<documents>`,
          ...board.all().map((e) =>
            [`<document title="${e.subtask.slice(0, 80)}">`, e.result, e.notes ? `Notes: ${e.notes}` : ``, `</document>`].join("\n")
          ),
          `</documents>`,
          ``,
          `<instructions>`,
          `## Request`,
          userPrompt,
          ``,
          renderContract(contract),
          ...(unverified.length > 0
            ? [
                ``,
                `Contributions from ${unverified.join(", ")} did not pass verification; reflect that ONLY inside the closing "Verification notes" section.`,
              ]
            : []),
          ...(feedback
            ? [
                ``,
                `## Your previous draft was rejected — fix exactly this`,
                feedback.critique.verdicts.filter((v) => !v.pass).map((v) => `${v.criterionId}: ${v.evidence}`).join("\n"),
              ]
            : []),
          `</instructions>`,
        ].join("\n"),
        schema: z.object({ answer: z.string() }),
        schemaName: "synthesis",
      }),
    async (candidate) => {
      const gates = runGates(candidate.answer, contract, board.all());
      const critique = await judge(llm, {
        rubric: [...ontology.outputRubric, ...contractCriteria],
        candidate: candidate.answer,
        context: `Final deliverable for: ${ontology.objective}. User request: ${userPrompt}`,
      });
      if (!gates.pass) {
        // Stable ids: key on the failure's own text prefix (gate name), not the
        // array index, so refine's repeat-failure escalation sees a stuck gate
        // as the SAME criterion across iterations.
        critique.verdicts.push(
          ...gates.failures.map((f) => ({
            criterionId: `gate-${f.split(":")[0].toLowerCase().replace(/\s+/g, "-")}`,
            pass: false,
            evidence: f,
          }))
        );
      }
      return critique;
    },
    { maxIterations: 2 }
  );
  if (synthesisOutcome.status !== "converged") unverified.push("synthesis");

  return {
    answer: synthesisOutcome.result.answer,
    planned: triage.agents.map((a) => a.id),
    escaped: false,
    board: board.all(),
    unverified,
  };
}
