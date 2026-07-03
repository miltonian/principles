import { describe, it, expect } from "vitest";
import { deriveFoundations } from "../../src/core/foundations";
import { Llm, LlmRequest } from "../../src/llm/gateway";

/** Scripted fake dispatching on schemaName — same fixtures as the pipeline test. */
const scriptedLlm = (): Llm =>
  (async <T>(req: LlmRequest<T>) => {
    switch (req.schemaName) {
      case "typed_truths":
        return { truths: [{ type: "constraint", statement: "must cite sources", rationale: "r" }] };
      case "truth_attack":
        return { verdict: "survives", strongestAttack: "none", justification: "solid" };
      case "decomposition":
        return { subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [] }] };
      case "rubric_verdicts":
        return {
          verdicts: [
            { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
            { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
            { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
            { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
          ],
        };
      default:
        throw new Error(`unexpected schema ${req.schemaName}`);
    }
  }) as unknown as Llm;

describe("deriveFoundations", () => {
  it("derives, vets, and decomposes without generating agent specs", async () => {
    const f = await deriveFoundations(scriptedLlm(), "evaluate study credibility");
    expect(f.truths).toHaveLength(1);
    expect(f.truths[0].id).toBe("t1");
    expect(f.vet.kept).toHaveLength(1);
    expect(f.vet.assumptions).toHaveLength(0);
    expect(f.subtasks).toHaveLength(1);
    expect(f.subtasks[0].id).toBe("s1");
    expect(f.decomposition.status).toBe("converged");
    // No "agent_spec" schema was requested — the scripted fake would have thrown.
  });

  it("throws when every truth is rejected", async () => {
    const llm = (async <T>(req: LlmRequest<T>) => {
      if (req.schemaName === "typed_truths")
        return { truths: [{ type: "fact", statement: "x", rationale: "r" }] };
      if (req.schemaName === "truth_attack")
        return { verdict: "reject", strongestAttack: "broken", justification: "j" };
      throw new Error(`unexpected schema ${req.schemaName}`);
    }) as unknown as Llm;
    await expect(deriveFoundations(llm, "obj")).rejects.toThrow(/no truths survived/i);
  });
});
