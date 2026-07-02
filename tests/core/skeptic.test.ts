import { describe, it, expect } from "vitest";
import { vetTruths } from "../../src/core/skeptic";
import { Truth } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const truths: Truth[] = [
  { id: "t1", type: "fact", statement: "A", rationale: "" },
  { id: "t2", type: "fact", statement: "B", rationale: "" },
  { id: "t3", type: "constraint", statement: "C", rationale: "" },
];

// Returns a different attack verdict per call, in order.
const fakeLlm = (verdicts: Array<{ verdict: string; strongestAttack: string; justification: string }>): Llm => {
  let i = 0;
  return (async () => verdicts[i++]) as unknown as Llm;
};

describe("vetTruths", () => {
  it("keeps survivors, demotes to assumptions, rejects broken truths", async () => {
    const llm = fakeLlm([
      { verdict: "survives", strongestAttack: "none found", justification: "solid" },
      { verdict: "demote", strongestAttack: "only true if X", justification: "unverifiable" },
      { verdict: "reject", strongestAttack: "counterexample Y", justification: "not required" },
    ]);
    const result = await vetTruths(llm, "obj", truths);
    expect(result.kept.map((t) => t.id)).toEqual(["t1"]);
    expect(result.assumptions.map((t) => t.id)).toEqual(["t2"]);
    expect(result.assumptions[0].type).toBe("assumption"); // demoted truths change type
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].truth.id).toBe("t3");
    expect(result.rejected[0].attack).toBe("counterexample Y");
  });
});
