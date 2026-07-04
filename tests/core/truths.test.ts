import { describe, it, expect } from "vitest";
import { deriveTruths } from "../../src/core/truths";
import { Llm } from "../../src/llm/gateway";

const fakeLlm = (response: unknown): Llm => (async () => response) as unknown as Llm;

const capturingFakeLlm = (response: unknown): { llm: Llm; capturedRequest: { system?: string; prompt: string } | null } => {
  let capturedRequest: { system?: string; prompt: string } | null = null;
  const llm = (async (req: any) => {
    capturedRequest = { system: req.system, prompt: req.prompt };
    return response;
  }) as unknown as Llm;
  return { llm, capturedRequest: null };
};

describe("deriveTruths", () => {
  it("assigns sequential ids in code, not from the model", async () => {
    const llm = fakeLlm({
      truths: [
        { type: "constraint", statement: "Output must be text", rationale: "LLM-only system" },
        { type: "assumption", statement: "User wants English", rationale: "Prompt is in English" },
      ],
    });
    const truths = await deriveTruths(llm, "some objective");
    expect(truths.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(truths[0].type).toBe("constraint");
  });

  it("returns an empty list as-is (pipeline decides how to react)", async () => {
    const truths = await deriveTruths(fakeLlm({ truths: [] }), "obj");
    expect(truths).toEqual([]);
  });

  it("includes artifact truths guidance in system prompt", async () => {
    let capturedSystem: string | undefined;
    const llm = (async (req: any) => {
      capturedSystem = req.system;
      return { truths: [] };
    }) as unknown as Llm;

    await deriveTruths(llm, "Create a video tutorial on TypeScript");
    expect(capturedSystem).toContain("truths about TWO subjects");
    expect(capturedSystem).toContain("what KIND of artifact");
    expect(capturedSystem).toContain("constraint truths about the deliverable");
  });
});
