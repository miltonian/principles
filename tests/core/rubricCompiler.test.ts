import { describe, it, expect } from "vitest";
import { draftCriteria } from "../../src/core/rubricCompiler";
import { Truth, Subtask } from "../../src/shared/types";

const truths: Truth[] = [
  { id: "t1", type: "constraint", statement: "Verdicts must cite evidence", rationale: "" },
  { id: "t2", type: "fact", statement: "Association is not causation", rationale: "" },
  { id: "t3", type: "constraint", statement: "Scope must match the claim", rationale: "" },
];
const subtasks: Subtask[] = [
  { id: "s1", description: "Extract the study methodology", servesTruths: ["t1"], dependsOn: [] },
  { id: "s2", description: "Assess statistical rigor", servesTruths: ["t1"], dependsOn: ["s1"] },
];

describe("draftCriteria", () => {
  it("orders generic, then constraint-truth, then subtask criteria with exact ids", () => {
    const criteria = draftCriteria(truths, subtasks);
    expect(criteria.map((c) => c.id)).toEqual(["c-responsive", "c-grounded", "c-t1", "c-t3", "c-s1", "c-s2"]);
  });

  it("sets provenance fields per source", () => {
    const criteria = draftCriteria(truths, subtasks);
    const ct1 = criteria.find((c) => c.id === "c-t1")!;
    expect(ct1.source).toBe("truth");
    expect(ct1.truthId).toBe("t1");
    expect(ct1.description).toContain("Verdicts must cite evidence");
    const cs2 = criteria.find((c) => c.id === "c-s2")!;
    expect(cs2.source).toBe("subtask");
    expect(cs2.subtaskId).toBe("s2");
    expect(cs2.description).toContain("Assess statistical rigor");
    const cg = criteria.find((c) => c.id === "c-grounded")!;
    expect(cg.source).toBe("generic");
  });

  it("skips non-constraint truths and starts all evidenceGuidance empty", () => {
    const criteria = draftCriteria(truths, subtasks);
    expect(criteria.find((c) => c.id === "c-t2")).toBeUndefined();
    expect(criteria.every((c) => c.evidenceGuidance === "")).toBe(true);
  });
});

import { addEvidenceGuidance, DEFAULT_EVIDENCE_GUIDANCE } from "../../src/core/rubricCompiler";
import { Llm, LlmRequest } from "../../src/llm/gateway";

const fakeLlm = (response: unknown, capture?: { req?: LlmRequest<unknown> }): Llm =>
  (async (req: LlmRequest<unknown>) => {
    if (capture) capture.req = req;
    return response;
  }) as unknown as Llm;

describe("addEvidenceGuidance", () => {
  const base = () => draftCriteria(truths, subtasks); // 6 criteria from Task 2 fixtures

  it("fills guidance from one batched call with schemaName rubric_guidance", async () => {
    const capture: { req?: LlmRequest<unknown> } = {};
    const llm = fakeLlm(
      { guidance: base().map((c) => ({ criterionId: c.id, evidenceGuidance: `look for ${c.id}` })) },
      capture
    );
    const out = await addEvidenceGuidance(llm, "obj", base());
    expect(capture.req!.schemaName).toBe("rubric_guidance");
    expect(out.map((c) => c.id)).toEqual(base().map((c) => c.id)); // order preserved
    expect(out.find((c) => c.id === "c-t1")!.evidenceGuidance).toBe("look for c-t1");
  });

  it("defaults guidance for criteria the model skipped and drops unknown ids", async () => {
    const llm = fakeLlm({
      guidance: [
        { criterionId: "c-t1", evidenceGuidance: "quote the citation" },
        { criterionId: "c-ghost", evidenceGuidance: "irrelevant" },
      ],
    });
    const out = await addEvidenceGuidance(llm, "obj", base());
    expect(out.find((c) => c.id === "c-t1")!.evidenceGuidance).toBe("quote the citation");
    expect(out.find((c) => c.id === "c-s1")!.evidenceGuidance).toBe(DEFAULT_EVIDENCE_GUIDANCE);
    expect(out.some((c) => (c.id as string) === "c-ghost")).toBe(false);
  });

  it("does not mutate its input", async () => {
    const input = base();
    const llm = fakeLlm({ guidance: [{ criterionId: "c-t1", evidenceGuidance: "x" }] });
    await addEvidenceGuidance(llm, "obj", input);
    expect(input.find((c) => c.id === "c-t1")!.evidenceGuidance).toBe("");
  });
});
