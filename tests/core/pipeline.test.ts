import { describe, it, expect } from "vitest";
import { generateOntology } from "../../src/core/pipeline";
import { Llm, LlmRequest } from "../../src/llm/gateway";

/**
 * Scripted fake: dispatches on schemaName so the test controls each stage.
 * Happy path: 1 truth survives vetting, decomposition passes the judge first try.
 */
const scriptedLlm = (): Llm =>
  (async <T>(req: LlmRequest<T>) => {
    switch (req.schemaName) {
      case "typed_truths":
        return { truths: [{ type: "constraint", statement: "must cite sources", rationale: "r" }] };
      case "truth_attack":
        return { verdict: "survives", strongestAttack: "none", justification: "solid" };
      case "decomposition":
        return { subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: false, webJustification: "" }] };
      case "rubric_verdicts":
        return {
          verdicts: [
            { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
            { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
            { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
            { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
          ],
        };
      case "agent_spec":
        return { name: "Source Analyzer", instructions: "analyze all sources", outputHint: "structured analysis" };
      default:
        throw new Error(`unexpected schema ${req.schemaName}`);
    }
  }) as unknown as Llm;

describe("generateOntology", () => {
  it("produces a full ontology on the happy path", async () => {
    const report = await generateOntology(scriptedLlm(), "evaluate study credibility");
    expect(report.decomposition.status).toBe("converged");
    expect(report.ontology.truths).toHaveLength(1);
    expect(report.ontology.subtasks).toHaveLength(1);
    expect(report.ontology.agents).toHaveLength(1);
    expect(report.ontology.agents[0].id).toBe("agent-s1");
    expect(report.ontology.outputRubric.map((c) => c.id)).toEqual(["o-responsive", "o-grounded", "o-t1"]);
    expect(report.ontology.objective).toBe("evaluate study credibility");
  });

  it("throws when every truth is rejected (nothing to build on)", async () => {
    const llm = (async <T>(req: LlmRequest<T>) => {
      if (req.schemaName === "typed_truths")
        return { truths: [{ type: "fact", statement: "x", rationale: "r" }] };
      if (req.schemaName === "truth_attack")
        return { verdict: "reject", strongestAttack: "broken", justification: "j" };
      throw new Error(`unexpected schema ${req.schemaName}`);
    }) as unknown as Llm;
    await expect(generateOntology(llm, "obj")).rejects.toThrow(/no truths survived/i);
  });
});
