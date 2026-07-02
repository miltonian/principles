import { describe, it, expect } from "vitest";
import { decompose } from "../../src/core/decompose";
import { Truth } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const truths: Truth[] = [{ id: "t1", type: "constraint", statement: "A", rationale: "" }];

const fakeLlm = (response: unknown, capture?: { prompt?: string }): Llm =>
  (async (req: any) => {
    if (capture) capture.prompt = req.prompt;
    return response;
  }) as unknown as Llm;

describe("decompose", () => {
  it("assigns ids in code and maps dependsOnIndices to ids", async () => {
    const llm = fakeLlm({
      subtasks: [
        { description: "first", servesTruths: ["t1"], dependsOnIndices: [] },
        { description: "second", servesTruths: ["t1"], dependsOnIndices: [1] },
      ],
    });
    const subtasks = await decompose(llm, "obj", truths, null);
    expect(subtasks.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(subtasks[1].dependsOn).toEqual(["s1"]);
  });

  it("marks out-of-range dependency indices so coverage checks catch them", async () => {
    const llm = fakeLlm({
      subtasks: [{ description: "only", servesTruths: ["t1"], dependsOnIndices: [9] }],
    });
    const subtasks = await decompose(llm, "obj", truths, null);
    expect(subtasks[0].dependsOn).toEqual(["invalid:9"]);
  });

  it("includes previous attempt and failed criteria in the prompt when given feedback", async () => {
    const capture: { prompt?: string } = {};
    const llm = fakeLlm({ subtasks: [] }, capture);
    await decompose(llm, "obj", truths, {
      previous: [{ id: "s1", description: "old subtask", servesTruths: ["t1"], dependsOn: [] }],
      critique: {
        verdicts: [
          { criterionId: "d-minimal", pass: false, evidence: "s1 bundles two actions" },
          { criterionId: "d-feasible", pass: true, evidence: "all text-only" },
        ],
      },
    });
    expect(capture.prompt).toContain("old subtask");
    expect(capture.prompt).toContain("s1 bundles two actions"); // failed criterion fed back
    expect(capture.prompt).toContain("d-feasible");             // passing criterion listed as preserve
  });
});
