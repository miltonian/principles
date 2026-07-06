import { describe, expect, it } from "vitest";
import { placeholderGate, retentionGate, roleLeakGate, runGates, substanceGate } from "../../src/runtime/renderGuard";
import type { DeliverableContract } from "../../src/runtime/contract";
import type { BlackboardEntry } from "../../src/runtime/blackboard";

const contract: DeliverableContract = { genre: "g", audience: "a", sections: [], totalBudgetWords: 2000 };

const entry = (agentId: string, result: string): BlackboardEntry => ({ agentId, subtask: "s", notes: "", result });

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

describe("retentionGate", () => {
  it("fails when a board URL is missing from the deliverable, quoting the URL and source agent", () => {
    const entries = [entry("agent-s1", "See https://example.com/report for the full dataset.")];
    const r = retentionGate("A deliverable that never mentions the source.", entries);
    expect(r.pass).toBe(false);
    expect(r.failures[0]).toContain("https://example.com/report");
    expect(r.failures[0]).toContain("agent-s1");
  });

  it("fails when a board figure is missing from the deliverable", () => {
    const entries = [entry("agent-s1", "The project raised $5M in funding, a 42% jump.")];
    const r = retentionGate("The project raised money and grew a lot.", entries);
    expect(r.pass).toBe(false);
    expect(r.failures.join(" ")).toContain("$5M");
    expect(r.failures.join(" ")).toContain("42%");
  });

  it("only flags capitalized names once they recur (≥2) across the board", () => {
    const onceEntries = [entry("agent-s1", "Jane Smith reviewed the filing once.")];
    expect(retentionGate("No names here.", onceEntries).pass).toBe(true);

    const twiceEntries = [
      entry("agent-s1", "Jane Smith reviewed the filing."),
      entry("agent-s2", "Jane Smith later signed off on it."),
    ];
    const r = retentionGate("A deliverable that never names the reviewer.", twiceEntries);
    expect(r.pass).toBe(false);
    expect(r.failures[0]).toContain("Jane Smith");
    expect(r.failures[0]).toContain("agent-s1"); // attributed to the first entry that produced it
  });

  it("omission-line escape: a specific listed as omitted in Verification notes still passes", () => {
    const entries = [entry("agent-s1", "See https://example.com/report for the full dataset.")];
    const deliverable = [
      "The body of this report covers the findings in depth.",
      "",
      "Verification notes: the source https://example.com/report was omitted from the body for brevity.",
    ].join("\n");
    expect(retentionGate(deliverable, entries).pass).toBe(true);
  });

  it("stoplist keeps heading-like pairs (e.g. 'Executive Summary') out even at ≥2 occurrences", () => {
    const entries = [
      entry("agent-s1", "Executive Summary: results were strong."),
      entry("agent-s2", "See the Executive Summary above for context."),
    ];
    expect(retentionGate("A deliverable with no heading callouts.", entries).pass).toBe(true);
  });

  it("passes when the deliverable retains every extracted specific", () => {
    const entries = [
      entry("agent-s1", "Jane Smith found that revenue grew 42% per https://example.com/report and no more."),
      entry("agent-s2", "Jane Smith's finding was corroborated independently."),
    ];
    const deliverable =
      "Jane Smith's analysis found revenue grew 42%, citing https://example.com/report and corroborated independently.";
    expect(retentionGate(deliverable, entries).pass).toBe(true);
  });

  it("caps reported failures at 10 with a quota note", () => {
    const entries = Array.from({ length: 15 }, (_, i) => entry(`agent-s${i}`, `See https://example.com/doc${i} for detail.`));
    const r = retentionGate("Nothing retained here.", entries);
    expect(r.pass).toBe(false);
    expect(r.failures.length).toBe(11); // 10 quoted + 1 quota note
    expect(r.failures[10]).toMatch(/quota|additional|not shown/i);
  });
});

describe("runGates", () => {
  it("aggregates failures across gates", () => {
    const r = runGates("I'm the synthesis agent. TODO: finish.", contract, []);
    expect(r.pass).toBe(false);
    expect(r.failures.length).toBeGreaterThanOrEqual(3); // leak + substance + placeholder
  });

  it("folds in retention failures from board entries", () => {
    const entries = [entry("agent-s1", "See https://example.com/report for detail.")];
    const r = runGates("A clean, on-topic deliverable of sufficient length.", contract, entries);
    expect(r.pass).toBe(false);
    expect(r.failures.join(" ")).toContain("https://example.com/report");
  });
});
