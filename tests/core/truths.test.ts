import { describe, it, expect } from "vitest";
import { deriveTruths } from "../../src/core/truths";
import { Llm } from "../../src/llm/gateway";

const fakeLlm = (response: unknown): Llm => (async () => response) as unknown as Llm;

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
});
