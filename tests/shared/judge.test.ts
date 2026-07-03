import { describe, it, expect } from "vitest";
import { judge } from "../../src/shared/judge";
import { Criterion, failures } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const rubric: Criterion[] = [
  { id: "c1", description: "is minimal", source: "generic" },
  { id: "c2", description: "is feasible", source: "generic" },
];

const fakeLlm = (verdicts: unknown): Llm =>
  (async () => ({ verdicts })) as unknown as Llm;

describe("judge", () => {
  it("returns the model's verdicts when complete and evidenced", async () => {
    const llm = fakeLlm([
      { criterionId: "c1", pass: true, evidence: "each subtask is one atomic action" },
      { criterionId: "c2", pass: false, evidence: "subtask s2 requires browsing the web" },
    ]);
    const critique = await judge(llm, { rubric, candidate: "cand", context: "ctx" });
    expect(critique.verdicts).toHaveLength(2);
    expect(failures(critique).map((f) => f.criterionId)).toEqual(["c2"]);
  });

  it("fails criteria the model skipped", async () => {
    const llm = fakeLlm([{ criterionId: "c1", pass: true, evidence: "long enough evidence" }]);
    const critique = await judge(llm, { rubric, candidate: "cand", context: "ctx" });
    const c2 = critique.verdicts.find((v) => v.criterionId === "c2")!;
    expect(c2.pass).toBe(false);
    expect(c2.evidence).toMatch(/not evaluated/i);
  });

  it("flips unevidenced passes to failures", async () => {
    const llm = fakeLlm([
      { criterionId: "c1", pass: true, evidence: "ok" }, // < 10 chars
      { criterionId: "c2", pass: true, evidence: "subtasks map 1:1 to text actions" },
    ]);
    const critique = await judge(llm, { rubric, candidate: "cand", context: "ctx" });
    const c1 = critique.verdicts.find((v) => v.criterionId === "c1")!;
    expect(c1.pass).toBe(false);
    expect(c1.evidence).toMatch(/no evidence/i);
  });

  it("drops verdicts for unknown criteria", async () => {
    const llm = fakeLlm([
      { criterionId: "ghost", pass: true, evidence: "irrelevant but long evidence" },
      { criterionId: "c1", pass: true, evidence: "long enough evidence here" },
      { criterionId: "c2", pass: true, evidence: "long enough evidence here" },
    ]);
    const critique = await judge(llm, { rubric, candidate: "cand", context: "ctx" });
    expect(critique.verdicts.map((v) => v.criterionId).sort()).toEqual(["c1", "c2"]);
  });
});
