import { describe, it, expect } from "vitest";
import { decompose } from "../../src/core/decompose";
import { Truth } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const truths: Truth[] = [{ id: "t1", type: "constraint", statement: "A", rationale: "" }];

const fakeLlm = (response: unknown, capture?: { prompt?: string; system?: string }): Llm =>
  (async (req: any) => {
    if (capture) {
      capture.prompt = req.prompt;
      capture.system = req.system;
    }
    return response;
  }) as unknown as Llm;

describe("decompose", () => {
  it("assigns ids in code and maps dependsOnIndices to ids", async () => {
    const llm = fakeLlm({
      subtasks: [
        { description: "first", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: false, webJustification: "" },
        { description: "second", servesTruths: ["t1"], dependsOnIndices: [1], needsWeb: false, webJustification: "" },
      ],
    });
    const subtasks = await decompose(llm, "obj", truths, null);
    expect(subtasks.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(subtasks[1].dependsOn).toEqual(["s1"]);
  });

  it("marks out-of-range dependency indices so coverage checks catch them", async () => {
    const llm = fakeLlm({
      subtasks: [{ description: "only", servesTruths: ["t1"], dependsOnIndices: [9], needsWeb: false, webJustification: "" }],
    });
    const subtasks = await decompose(llm, "obj", truths, null);
    expect(subtasks[0].dependsOn).toEqual(["invalid:9"]);
  });

  it("includes previous attempt and failed criteria in the prompt when given feedback", async () => {
    const capture: { prompt?: string } = {};
    const llm = fakeLlm({ subtasks: [] }, capture);
    await decompose(llm, "obj", truths, {
      previous: [{ id: "s1", description: "old subtask", servesTruths: ["t1"], dependsOn: [], needsWeb: false, webJustification: "" }],
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

  it("carries the previous attempt's web request into the feedback section", async () => {
    const capture: { prompt?: string } = {};
    const llm = fakeLlm({ subtasks: [] }, capture);
    await decompose(llm, "obj", truths, {
      previous: [
        {
          id: "s1",
          description: "old subtask",
          servesTruths: ["t1"],
          dependsOn: [],
          needsWeb: true,
          webJustification: "needs the external paper",
        },
      ],
      critique: {
        verdicts: [{ criterionId: "d-minimal", pass: true, evidence: "fine" }],
      },
    });
    expect(capture.prompt).toContain("WEB REQUESTED: needs the external paper");
  });

  it("maps needsWeb and webJustification from the model output", async () => {
    const llm = fakeLlm({
      subtasks: [
        { description: "fetch the paper", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: true, webJustification: "the study text is external" },
        { description: "summarize", servesTruths: ["t1"], dependsOnIndices: [1], needsWeb: false, webJustification: "" },
      ],
    });
    const subtasks = await decompose(llm, "obj", truths, null);
    expect(subtasks[0].needsWeb).toBe(true);
    expect(subtasks[0].webJustification).toBe("the study text is external");
    expect(subtasks[1].needsWeb).toBe(false);
    expect(subtasks[1].webJustification).toBe("");
  });

  it("instructs the model about needsWeb in the prompt", async () => {
    const capture: { prompt?: string; system?: string } = {};
    const llm = fakeLlm({ subtasks: [] }, capture);
    await decompose(llm, "obj", truths, null);
    const fullRequest = `${capture.system}\n${capture.prompt}`;
    expect(fullRequest).toContain("needsWeb");
    expect((fullRequest.match(/needsWeb: set true ONLY/g)?.length) ?? 0).toBe(1);
  });
});
