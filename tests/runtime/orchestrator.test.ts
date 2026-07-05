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

// Long enough (2 agents => 150-word budget each => 300 total => 75-word substance
// floor) and free of role-leak / placeholder patterns, so it clears the render gates.
const LONG_SYNTHESIS_ANSWER = [
  "This deliverable brings together the analysis and the conclusion produced during the investigation",
  "into a single, self-contained report intended for a careful reviewer.",
  "The first section lays out the core observations drawn from the available material,",
  "tracing each claim back to the evidence that supports it and flagging any tension",
  "between sources rather than smoothing it over.",
  "The second section states the resulting judgment plainly, explaining why the conclusion follows",
  "from what was actually reviewed rather than from assumption.",
  "Together these sections give a reader everything needed to evaluate the claim on its",
  "own terms, without needing to consult any additional material or ask further questions.",
].join(" ");

/** Passing verdicts for the synthesis-level judge (ontology rubric + contract criteria). */
const synthesisPassVerdicts = {
  verdicts: [
    { criterionId: "o-responsive", pass: true, evidence: "directly answers the question" },
    { criterionId: "o-t1", pass: true, evidence: "evidence cited inline" },
    { criterionId: "o-t9", pass: true, evidence: "contrasts the two approaches" },
    { criterionId: "c-contract-genre", pass: true, evidence: "reads as a standalone finished document for the reviewer" },
    { criterionId: "c-contract-sections", pass: true, evidence: "covers every outline item substantively" },
    { criterionId: "c-contract-clean", pass: true, evidence: "no internal-process narration; caveats confined to closing notes" },
  ],
};

/** Scripted by schemaName: plan → agent_output×2 (+judge passes) → synthesis (+judge pass). */
const scriptedLlm = (log: string[]): Llm =>
  (async <T>(req: LlmRequest<T>) => {
    log.push(req.schemaName);
    switch (req.schemaName) {
      case "triage_plan":
        return { fits: true, reason: "on-domain", selectedAgentIds: ["agent-s1", "agent-s2"], deliverableGenre: "analysis", deliverableAudience: "reviewer" };
      case "agent_output":
        return { notes: "n", result: "agent deliverable" };
      case "rubric_verdicts":
        if (req.prompt.includes("c-contract-genre")) return synthesisPassVerdicts;
        return { verdicts: [{ criterionId: "o-responsive", pass: true, evidence: "directly answers the question" }] };
      case "synthesis":
        return { answer: LONG_SYNTHESIS_ANSWER };
      default:
        throw new Error(`unexpected schema ${req.schemaName}`);
    }
  }) as unknown as Llm;

/** Scripted variant where the agent-level rubric judge always fails — no agent ever
 * converges — but the synthesis-level judge (keyed on the contract criteria ids in
 * the prompt) still passes, so this test stays isolated to agent-level behavior. */
const scriptedLlmAlwaysFailingRubric = (log: string[]): Llm =>
  (async <T>(req: LlmRequest<T>) => {
    log.push(req.schemaName);
    switch (req.schemaName) {
      case "triage_plan":
        return { fits: true, reason: "on-domain", selectedAgentIds: ["agent-s1", "agent-s2"], deliverableGenre: "analysis", deliverableAudience: "reviewer" };
      case "agent_output":
        return { notes: "n", result: "agent deliverable" };
      case "rubric_verdicts":
        if (req.prompt.includes("c-contract-genre")) return synthesisPassVerdicts;
        return { verdicts: [{ criterionId: "o-responsive", pass: false, evidence: "does not address the prompt" }] };
      case "synthesis":
        return { answer: LONG_SYNTHESIS_ANSWER };
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
    // 1 agent selected => 150-word section budget => 38-word substance floor.
    const longAnswer =
      "This analysis addresses the original question directly, citing the specific evidence located " +
      "in the material and contrasting the different approaches under consideration so the distinctions " +
      "are clear to a reader encountering this material for the first time without any additional context " +
      "or further explanation needed from anyone else.";
    const llm = (async <T>(req: LlmRequest<T>) => {
      switch (req.schemaName) {
        case "triage_plan":
          return { fits: true, reason: "on-domain", selectedAgentIds: ["agent-s1"], deliverableGenre: "analysis", deliverableAudience: "reviewer" };
        case "agent_output":
          return { notes: "n", result: "agent deliverable" };
        case "rubric_verdicts":
          judgePrompts.push(req.prompt);
          if (req.prompt.includes("c-contract-genre")) return synthesisPassVerdicts;
          return {
            verdicts: [
              { criterionId: "o-responsive", pass: true, evidence: "answers directly" },
              { criterionId: "o-t1", pass: true, evidence: "evidence cited inline" },
            ],
          };
        case "synthesis":
          return { answer: longAnswer };
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
    expect(result.answer).toBe(LONG_SYNTHESIS_ANSWER);
    expect(result.planned).toEqual(["agent-s1", "agent-s2"]);
    expect(result.board).toHaveLength(2);
    expect(result.unverified).toEqual([]);
    expect(log[0]).toBe("triage_plan");
    expect(log).toContain("synthesis");
    // Synthesis is now judged too: the last call is the synthesis-level rubric check.
    expect(log[log.length - 1]).toBe("rubric_verdicts");
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
    expect(result.answer).toBe(LONG_SYNTHESIS_ANSWER);
    expect(result.unverified).toEqual(["agent-s1", "agent-s2"]);
    expect(result.board).toHaveLength(2);
    expect(result.board.map((e) => e.agentId)).toEqual(["agent-s1", "agent-s2"]);
  });

  it("synthesis prompt is data-first/instructions-last with the contract, and converged runs stay clean", async () => {
    const prompts: Record<string, string[]> = { synthesis: [], rubric_verdicts: [] };
    const scriptedContractLlm = (): Llm =>
      (async <T>(req: LlmRequest<T>) => {
        if (prompts[req.schemaName]) prompts[req.schemaName].push(req.prompt);
        switch (req.schemaName) {
          case "triage_plan":
            return { fits: true, reason: "on-domain", selectedAgentIds: ["agent-s1", "agent-s2"], deliverableGenre: "analysis", deliverableAudience: "reviewer" };
          case "agent_output":
            return { notes: "n", result: "agent deliverable" };
          case "rubric_verdicts":
            if (req.prompt.includes("c-contract-genre")) return synthesisPassVerdicts;
            return { verdicts: [{ criterionId: "o-responsive", pass: true, evidence: "directly answers the question" }] };
          case "synthesis":
            return { answer: LONG_SYNTHESIS_ANSWER };
          default:
            throw new Error(`unexpected schema ${req.schemaName}`);
        }
      }) as unknown as Llm;

    const result = await runOntology(scriptedContractLlm(), ontology, "Write me a report on X");
    const sp = prompts.synthesis[0];
    expect(sp.indexOf("<documents>")).toBeGreaterThanOrEqual(0);
    expect(sp.indexOf("<instructions>")).toBeGreaterThan(sp.indexOf("</documents>"));
    expect(sp).toContain("The answer IS the finished document");
    expect(result.unverified).not.toContain("synthesis");
  });

  it("gate failures are quoted into the synthesis retry and non-convergence flags 'synthesis'", async () => {
    const prompts: string[] = [];
    const scriptedLeakyLlm = (): Llm =>
      (async <T>(req: LlmRequest<T>) => {
        switch (req.schemaName) {
          case "triage_plan":
            return { fits: true, reason: "on-domain", selectedAgentIds: ["agent-s1", "agent-s2"], deliverableGenre: "analysis", deliverableAudience: "reviewer" };
          case "agent_output":
            return { notes: "n", result: "agent deliverable" };
          case "rubric_verdicts":
            // Synthesis judge always passes — gates alone must force iteration.
            if (req.prompt.includes("c-contract-genre")) return synthesisPassVerdicts;
            return { verdicts: [{ criterionId: "o-responsive", pass: true, evidence: "directly answers the question" }] };
          case "synthesis":
            prompts.push(req.prompt);
            return { answer: "I'm the synthesis agent. Done." };
          default:
            throw new Error(`unexpected schema ${req.schemaName}`);
        }
      }) as unknown as Llm;

    const result = await runOntology(scriptedLeakyLlm(), ontology, "Write me a report on X");
    expect(prompts.length).toBeGreaterThanOrEqual(2); // initial + at least one retry
    expect(prompts[1]).toContain("synthesis agent"); // quoted offense fed back
    expect(result.unverified).toContain("synthesis");
    expect(result.answer).toContain("I'm the synthesis agent"); // best candidate still shipped, flagged
  });

  it("a board URL dropped from the synthesis answer trips the retention gate, quoted into the retry", async () => {
    const prompts: string[] = [];
    let synthesisCalls = 0;
    const scriptedDroppedUrlLlm = (): Llm =>
      (async <T>(req: LlmRequest<T>) => {
        switch (req.schemaName) {
          case "triage_plan":
            return { fits: true, reason: "on-domain", selectedAgentIds: ["agent-s1", "agent-s2"], deliverableGenre: "analysis", deliverableAudience: "reviewer" };
          case "agent_output":
            return { notes: "n", result: "Findings cite https://example.com/source-data directly." };
          case "rubric_verdicts":
            // Synthesis judge always passes — the gate alone must force iteration.
            if (req.prompt.includes("c-contract-genre")) return synthesisPassVerdicts;
            return { verdicts: [{ criterionId: "o-responsive", pass: true, evidence: "directly answers the question" }] };
          case "synthesis":
            synthesisCalls += 1;
            prompts.push(req.prompt);
            // First draft drops the board URL; the retry (fed the gate failure) restores it.
            return {
              answer:
                synthesisCalls === 1
                  ? LONG_SYNTHESIS_ANSWER
                  : `${LONG_SYNTHESIS_ANSWER} Source: https://example.com/source-data.`,
            };
          default:
            throw new Error(`unexpected schema ${req.schemaName}`);
        }
      }) as unknown as Llm;

    const result = await runOntology(scriptedDroppedUrlLlm(), ontology, "Write me a report on X");
    expect(prompts.length).toBeGreaterThanOrEqual(2); // initial + at least one retry
    expect(prompts[1]).toContain("https://example.com/source-data"); // quoted specific fed back
    expect(prompts[1]).toContain("agent-s1"); // attributed to the source agent
    expect(result.unverified).not.toContain("synthesis"); // recovered on retry
    expect(result.answer).toContain("https://example.com/source-data");
  });
});
