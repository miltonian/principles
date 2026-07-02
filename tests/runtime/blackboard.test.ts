import { describe, it, expect } from "vitest";
import { Blackboard } from "../../src/runtime/blackboard";

describe("Blackboard", () => {
  it("accumulates entries in order and renders them all", () => {
    const board = new Blackboard();
    board.add({ agentId: "agent-s1", subtask: "analyze", notes: "n1", result: "r1" });
    board.add({ agentId: "agent-s2", subtask: "summarize", notes: "n2", result: "r2" });
    expect(board.all()).toHaveLength(2);
    const rendered = board.render();
    expect(rendered.indexOf("agent-s1")).toBeLessThan(rendered.indexOf("agent-s2"));
    expect(rendered).toContain("n1");
    expect(rendered).toContain("r2");
  });

  it("renders a placeholder when empty", () => {
    expect(new Blackboard().render()).toContain("(no prior agent output yet)");
  });
});
