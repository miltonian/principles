import { describe, expect, it } from "vitest";
import { placeholderGate, roleLeakGate, runGates, substanceGate } from "../../src/runtime/renderGuard";
import type { DeliverableContract } from "../../src/runtime/contract";

const contract: DeliverableContract = { genre: "g", audience: "a", sections: [], totalBudgetWords: 2000 };

describe("roleLeakGate", () => {
  it("fails on internal vocabulary, quoting the offense", () => {
    const r = roleLeakGate("I'm the synthesis agent; the blackboard already contains a design.");
    expect(r.pass).toBe(false);
    expect(r.failures.join(" ")).toContain("synthesis agent");
    expect(roleLeakGate("Work assigned to agent-s4 was incomplete.").pass).toBe(false);
  });
  it("passes legitimate topical uses of 'agent'", () => {
    expect(roleLeakGate("AI agents adopting MCP grew rapidly; multi-agent systems benefit.").pass).toBe(true);
  });
  it("passes reports ABOUT multi-agent architectures (review-flagged false-positive risk)", () => {
    expect(roleLeakGate("The blackboard pattern is a classic architecture; a synthesis agent aggregates worker outputs.").pass).toBe(true);
    expect(roleLeakGate("This design serves as the synthesis of both approaches.").pass).toBe(true);
  });
  it("still fails first-person process narration", () => {
    expect(roleLeakGate("The blackboard already contains a full design.").pass).toBe(false);
    expect(roleLeakGate("My fellow agents produced drafts.").pass).toBe(false);
    expect(roleLeakGate("I am the synthesis agent, and I combined the drafts.").pass).toBe(false);
  });
  it("passes textbook blackboard-pattern descriptions (review-flagged residual)", () => {
    expect(roleLeakGate("Knowledge sources post partial solutions on the blackboard.").pass).toBe(true);
  });
});

describe("substanceGate", () => {
  it("fails under 25% of budget naming both numbers", () => {
    const r = substanceGate("only ten words of content here for the whole report", contract);
    expect(r.pass).toBe(false);
    expect(r.failures[0]).toContain("2000");
    expect(substanceGate(Array(600).fill("w").join(" "), contract).pass).toBe(true);
  });
});

describe("placeholderGate", () => {
  it("fails on TBD/TODO/[placeholder]", () => {
    expect(placeholderGate("Cost: TBD").pass).toBe(false);
    expect(placeholderGate("A todo-list app design").pass).toBe(true); // word-boundary + case rules
  });
});

describe("runGates", () => {
  it("aggregates failures across gates", () => {
    const r = runGates("I'm the synthesis agent. TODO: finish.", contract);
    expect(r.pass).toBe(false);
    expect(r.failures.length).toBeGreaterThanOrEqual(3); // leak + substance + placeholder
  });
});
