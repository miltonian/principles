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
