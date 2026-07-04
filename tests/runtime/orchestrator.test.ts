import { describe, it, expect } from "vitest";
import { runOntology } from "../../src/runtime/orchestrator";
import { Ontology } from "../../src/shared/types";
import { Llm, LlmRequest } from "../../src/llm/gateway";

const ontology: Ontology = {
  objective: "evaluate claims",
  truths: [{ id: "t1", type: "constraint", statement: "cite evidence", rationale: "" }],
  assumptions: [],
  subtasks: [
    { id: "s1", description: "analyze", servesTruths: ["t1"], dependsOn: [] },
    { id: "s2", description: "conclude", servesTruths: ["t1"], dependsOn: ["s1"] },
  ],
  agents: [
    { id: "agent-s1", name: "Analyzer", subtaskId: "s1", instructions: "analyze", servesTruths: ["t1"], dependsOn: [], outputHint: "analysis" },
    { id: "agent-s2", name: "Concluder", subtaskId: "s2", instructions: "conclude", servesTruths: ["t1"], dependsOn: ["agent-s1"], outputHint: "conclusion" },
  ],
  outputRubric: [{ id: "o-responsive", description: "addresses the prompt", source: "generic" }],
};

/** Scripted by schemaName: plan → agent_output×2 (+judge passes) → synthesis. */
const scriptedLlm = (log: string[]): Llm =>
  (async <T>(req: LlmRequest<T>) => {
    log.push(req.schemaName);
    switch (req.schemaName) {
      case "triage_plan":
        return { fits: true, reason: "on-domain", selectedAgentIds: ["agent-s1", "agent-s2"], deliverableGenre: "analysis", deliverableAudience: "reviewer" };
      case "agent_output":
        return { notes: "n", result: "agent deliverable" };
      case "rubric_verdicts":
        return { verdicts: [{ criterionId: "o-responsive", pass: true, evidence: "directly answers the question" }] };
      case "synthesis":
        return { answer: "final synthesized answer" };
      default:
        throw new Error(`unexpected schema ${req.schemaName}`);
    }
  }) as unknown as Llm;

/** Scripted variant where the rubric judge always fails — no agent ever converges. */
const scriptedLlmAlwaysFailingRubric = (log: string[]): Llm =>
  (async <T>(req: LlmRequest<T>) => {
    log.push(req.schemaName);
    switch (req.schemaName) {
      case "triage_plan":
        return { fits: true, reason: "on-domain", selectedAgentIds: ["agent-s1", "agent-s2"], deliverableGenre: "analysis", deliverableAudience: "reviewer" };
      case "agent_output":
        return { notes: "n", result: "agent deliverable" };
      case "rubric_verdicts":
        return { verdicts: [{ criterionId: "o-responsive", pass: false, evidence: "does not address the prompt" }] };
      case "synthesis":
        return { answer: "final synthesized answer" };
      default:
        throw new Error(`unexpected schema ${req.schemaName}`);
    }
  }) as unknown as Llm;

describe("runOntology", () => {
  it("scopes the judge rubric per agent: truth criteria apply only to agents whose subtask cites that truth (live: global rubric failed all 10 agents on a research task)", async () => {
    const scoped: Ontology = {
      ...ontology,
      truths: [
        { id: "t1", type: "constraint", statement: "cite evidence", rationale: "" },
        { id: "t9", type: "constraint", statement: "contrast APIs vs MCP", rationale: "" },
      ],
      outputRubric: [
        { id: "o-responsive", description: "addresses the prompt", source: "generic" },
        { id: "o-t1", description: 'satisfies: "cite evidence"', source: "truth", truthId: "t1" },
        { id: "o-t9", description: 'satisfies: "contrast APIs vs MCP"', source: "truth", truthId: "t9" },
      ],
    };
    const judgePrompts: string[] = [];
    const llm = (async <T>(req: LlmRequest<T>) => {
      switch (req.schemaName) {
        case "triage_plan":
          return { fits: true, reason: "on-domain", selectedAgentIds: ["agent-s1"], deliverableGenre: "analysis", deliverableAudience: "reviewer" };
        case "agent_output":
          return { notes: "n", result: "agent deliverable" };
        case "rubric_verdicts":
          judgePrompts.push(req.prompt);
          return {
            verdicts: [
              { criterionId: "o-responsive", pass: true, evidence: "answers directly" },
              { criterionId: "o-t1", pass: true, evidence: "evidence cited inline" },
            ],
          };
        case "synthesis":
          return { answer: "final" };
        default:
          throw new Error(`unexpected schema ${req.schemaName}`);
      }
    }) as unknown as Llm;
    const result = await runOntology(llm, scoped, "prompt");
    // agent-s1 serves only t1: its judge must see o-t1 but never o-t9 —
    // and with o-t9 absent from the rubric, the judge's mechanical
    // skipped-criterion rule must not fail the agent for it.
    expect(judgePrompts[0]).toContain("o-t1");
    expect(judgePrompts[0]).not.toContain("o-t9");
    expect(result.unverified).toEqual([]);
  });

  it("plans, executes agents in dependency order, and synthesizes from the board", async () => {
    const log: string[] = [];
    const result = await runOntology(scriptedLlm(log), ontology, "is this claim credible?");
    expect(result.escaped).toBe(false);
    expect(result.answer).toBe("final synthesized answer");
    expect(result.planned).toEqual(["agent-s1", "agent-s2"]);
    expect(result.board).toHaveLength(2);
    expect(result.unverified).toEqual([]);
    expect(log[0]).toBe("triage_plan");
    expect(log[log.length - 1]).toBe("synthesis");
  });

  it("escapes to a direct answer when the frame does not fit", async () => {
    const llm = (async <T>(req: LlmRequest<T>) => {
      if (req.schemaName === "triage_plan")
        return { fits: false, reason: "off-domain", selectedAgentIds: [] };
      if (req.schemaName === "direct_answer") return { answer: "direct answer" };
      throw new Error(`unexpected schema ${req.schemaName}`);
    }) as unknown as Llm;
    const result = await runOntology(llm, ontology, "unrelated prompt");
    expect(result.escaped).toBe(true);
    expect(result.answer).toBe("direct answer");
    expect(result.board).toEqual([]);
  });

  it("flags agents that never converge as unverified, but still keeps and synthesizes their output", async () => {
    const log: string[] = [];
    const result = await runOntology(scriptedLlmAlwaysFailingRubric(log), ontology, "is this claim credible?");
    expect(result.answer).toBe("final synthesized answer");
    expect(result.unverified).toEqual(["agent-s1", "agent-s2"]);
    expect(result.board).toHaveLength(2);
    expect(result.board.map((e) => e.agentId)).toEqual(["agent-s1", "agent-s2"]);
  });
});
