import { describe, it, expect } from "vitest";
import { generateAgentSpecs } from "../../src/core/specs";
import { Truth, Subtask } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const truths: Truth[] = [{ id: "t1", type: "constraint", statement: "A", rationale: "" }];
const subtasks: Subtask[] = [
  { id: "s1", description: "analyze", servesTruths: ["t1"], dependsOn: [] },
  { id: "s2", description: "summarize", servesTruths: ["t1"], dependsOn: ["s1"] },
];

const fakeLlm = (): Llm =>
  (async () => ({ name: "Analyzer", instructions: "do the thing", outputHint: "a paragraph" })) as unknown as Llm;

describe("generateAgentSpecs", () => {
  it("derives ids, dependencies, and truth citations from the subtasks in code", async () => {
    const specs = await generateAgentSpecs(fakeLlm(), "obj", truths, subtasks);
    expect(specs.map((s) => s.id)).toEqual(["agent-s1", "agent-s2"]);
    expect(specs[1].dependsOn).toEqual(["agent-s1"]);
    expect(specs[0].servesTruths).toEqual(["t1"]);
    expect(specs[0].subtaskId).toBe("s1");
    expect(specs[0].instructions).toBe("do the thing");
  });

  it("propagates needsWeb → webTools, key absent when false", async () => {
    const webbed: Subtask[] = [
      { id: "s1", description: "fetch", servesTruths: ["t1"], dependsOn: [], needsWeb: true, webJustification: "external paper" },
      { id: "s2", description: "summarize", servesTruths: ["t1"], dependsOn: ["s1"], needsWeb: false, webJustification: "" },
    ];
    const specs = await generateAgentSpecs(fakeLlm(), "obj", truths, webbed);
    expect(specs[0].webTools).toBe(true);
    expect("webTools" in specs[1]).toBe(false);
  });
});
