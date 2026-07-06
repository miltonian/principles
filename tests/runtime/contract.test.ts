import { describe, expect, it } from "vitest";
import { buildContract, renderContract, sectionBudget, sectionTitle } from "../../src/runtime/contract";
import type { AgentSpec } from "../../src/shared/types";

const spec = (id: string, instructions: string): AgentSpec =>
  ({ id, name: id, subtaskId: id.replace("agent-", ""), instructions, servesTruths: ["t1"], dependsOn: [], outputHint: "text" });
const entry = (agentId: string, words: number) =>
  ({ agentId, subtask: "s", notes: "", result: Array(words).fill("w").join(" ") });

describe("sectionBudget", () => {
  it("is 40% of source words, clamped to [150, 1200]", () => {
    expect(sectionBudget(1000)).toBe(400);
    expect(sectionBudget(100)).toBe(150);
    expect(sectionBudget(10000)).toBe(1200);
  });
});

describe("sectionTitle", () => {
  it("takes the first clause and caps at 60 chars", () => {
    expect(sectionTitle("Analyze the market. Then produce tables.")).toBe("Analyze the market");
    expect(sectionTitle("x".repeat(80))).toHaveLength(60);
  });
});

describe("buildContract", () => {
  it("builds sections only for agents with board entries, in spec order, with fallbacks", () => {
    const c = buildContract(undefined, undefined, [spec("agent-s1", "Research A."), spec("agent-s2", "Research B.")], [entry("agent-s1", 1000)]);
    expect(c.genre).toBe("comprehensive written response");
    expect(c.audience).toBe("the requester");
    expect(c.sections).toEqual([{ title: "Research A", budgetWords: 400, agentId: "agent-s1" }]);
    expect(c.totalBudgetWords).toBe(400);
  });
  it("uses provided genre/audience", () => {
    const c = buildContract("research report", "engineers", [spec("agent-s1", "Research A.")], [entry("agent-s1", 500)]);
    expect(c.genre).toBe("research report");
    expect(c.audience).toBe("engineers");
  });
});

describe("renderContract", () => {
  const c = buildContract("research report", "engineers", [spec("agent-s1", "Research A.")], [entry("agent-s1", 1000)]);
  const text = renderContract(c);
  it("carries genre, audience, outline with budgets, and the discipline lines", () => {
    expect(text).toContain("research report");
    expect(text).toContain("engineers");
    expect(text).toContain("Research A (~400 words)");
    expect(text).toContain("The answer IS the finished document");
    expect(text).toContain("Verification notes");
    expect(text).toContain("without preamble");
    expect(text).not.toMatch(/blackboard/i);
    expect(text).toContain("Concrete names, figures, and cited sources from the material are load-bearing");
  });
});
