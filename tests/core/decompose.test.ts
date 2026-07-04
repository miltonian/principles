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
      coverageMap: [],
    });
    const { subtasks } = await decompose(llm, "obj", truths, null);
    expect(subtasks.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(subtasks[1].dependsOn).toEqual(["s1"]);
  });

  it("marks out-of-range dependency indices so coverage checks catch them", async () => {
    const llm = fakeLlm({
      subtasks: [{ description: "only", servesTruths: ["t1"], dependsOnIndices: [9], needsWeb: false, webJustification: "" }],
      coverageMap: [],
    });
    const { subtasks } = await decompose(llm, "obj", truths, null);
    expect(subtasks[0].dependsOn).toEqual(["invalid:9"]);
  });

  it("includes previous attempt and failed criteria in the prompt when given feedback", async () => {
    const capture: { prompt?: string } = {};
    const llm = fakeLlm({ subtasks: [], coverageMap: [] }, capture);
    await decompose(llm, "obj", truths, {
      previous: {
        subtasks: [{ id: "s1", description: "old subtask", servesTruths: ["t1"], dependsOn: [], needsWeb: false, webJustification: "" }],
        coverageMap: [],
      },
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
    const llm = fakeLlm({ subtasks: [], coverageMap: [] }, capture);
    await decompose(llm, "obj", truths, {
      previous: {
        subtasks: [
          {
            id: "s1",
            description: "old subtask",
            servesTruths: ["t1"],
            dependsOn: [],
            needsWeb: true,
            webJustification: "needs the external paper",
          },
        ],
        coverageMap: [],
      },
      critique: {
        verdicts: [{ criterionId: "d-minimal", pass: true, evidence: "fine" }],
      },
    });
    expect(capture.prompt).toContain("WEB REQUESTED: needs the external paper");
  });

  it("carries the previous attempt's coverage map into the feedback section", async () => {
    const capture: { prompt?: string } = {};
    const llm = fakeLlm({ subtasks: [], coverageMap: [] }, capture);
    await decompose(llm, "obj", truths, {
      previous: {
        subtasks: [{ id: "s1", description: "old subtask", servesTruths: ["t1"], dependsOn: [], needsWeb: false, webJustification: "" }],
        coverageMap: [
          { dimension: "History", handledBy: "s1", exclusionReason: "" },
          { dimension: "Future outlook", handledBy: "", exclusionReason: "out of scope for this brief" },
        ],
      },
      critique: {
        verdicts: [{ criterionId: "d-breadth", pass: false, evidence: "missing a dimension" }],
      },
    });
    expect(capture.prompt).toContain("History");
    expect(capture.prompt).toContain("out of scope for this brief");
  });

  it("maps needsWeb and webJustification from the model output", async () => {
    const llm = fakeLlm({
      subtasks: [
        { description: "fetch the paper", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: true, webJustification: "the study text is external" },
        { description: "summarize", servesTruths: ["t1"], dependsOnIndices: [1], needsWeb: false, webJustification: "" },
      ],
      coverageMap: [],
    });
    const { subtasks } = await decompose(llm, "obj", truths, null);
    expect(subtasks[0].needsWeb).toBe(true);
    expect(subtasks[0].webJustification).toBe("the study text is external");
    expect(subtasks[1].needsWeb).toBe(false);
    expect(subtasks[1].webJustification).toBe("");
  });

  it("instructs the model about needsWeb in the prompt", async () => {
    const capture: { prompt?: string; system?: string } = {};
    const llm = fakeLlm({ subtasks: [], coverageMap: [] }, capture);
    await decompose(llm, "obj", truths, null);
    const fullRequest = `${capture.system}\n${capture.prompt}`;
    expect(fullRequest).toContain("needsWeb");
    expect((fullRequest.match(/needsWeb: set true ONLY/g)?.length) ?? 0).toBe(1);
  });

  it("instructs the model with the survey-instinct rule for the coverage map", async () => {
    const capture: { prompt?: string; system?: string } = {};
    const llm = fakeLlm({ subtasks: [], coverageMap: [] }, capture);
    await decompose(llm, "obj", truths, null);
    const fullRequest = `${capture.system}\n${capture.prompt}`;
    expect(fullRequest).toContain("survey instinct");
    expect(fullRequest).toContain("Silent narrowing");
  });

  it("parses coverageMap rows and maps a handledBy index to the real subtask id", async () => {
    const llm = fakeLlm({
      subtasks: [{ description: "first", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: false, webJustification: "" }],
      coverageMap: [
        { dimension: "History", handledBy: "1", exclusionReason: "" },
        { dimension: "Future outlook", handledBy: "", exclusionReason: "out of scope for this brief" },
      ],
    });
    const { coverageMap } = await decompose(llm, "obj", truths, null);
    expect(coverageMap).toEqual([
      { dimension: "History", handledBy: "s1", exclusionReason: "" },
      { dimension: "Future outlook", handledBy: "", exclusionReason: "out of scope for this brief" },
    ]);
  });

  it("marks an out-of-range handledBy index as invalid so cov-breadth catches it", async () => {
    const llm = fakeLlm({
      subtasks: [{ description: "first", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: false, webJustification: "" }],
      coverageMap: [{ dimension: "History", handledBy: "9", exclusionReason: "" }],
    });
    const { coverageMap } = await decompose(llm, "obj", truths, null);
    expect(coverageMap[0].handledBy).toBe("invalid:9");
  });
});
