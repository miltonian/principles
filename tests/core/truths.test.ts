import { describe, it, expect } from "vitest";
import { deriveTruths } from "../../src/core/truths";
import { Llm, LlmRequest } from "../../src/llm/gateway";
import { Observation } from "../../src/shared/types";

const fakeLlm = (response: unknown): Llm => (async () => response) as unknown as Llm;

describe("deriveTruths", () => {
  it("assigns sequential ids in code, not from the model", async () => {
    const llm = fakeLlm({
      truths: [
        { type: "constraint", statement: "Output must be text", rationale: "LLM-only system", groundedIn: [] },
        { type: "assumption", statement: "User wants English", rationale: "Prompt is in English", groundedIn: [] },
      ],
    });
    const truths = await deriveTruths(llm, "some objective");
    expect(truths.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(truths[0].type).toBe("constraint");
  });

  it("defaults groundedIn to [] when the model omits it (defensive mapping)", async () => {
    const llm = (async () => ({
      truths: [{ type: "fact", statement: "x", rationale: "r" }], // groundedIn deliberately absent
    })) as unknown as Llm;
    const truths = await deriveTruths(llm, "obj");
    expect(truths[0].groundedIn).toEqual([]);
  });

  it("copies groundedIn ids from the model response", async () => {
    const llm = fakeLlm({
      truths: [{ type: "fact", statement: "x", rationale: "r", groundedIn: ["obs1", "obs2"] }],
    });
    const truths = await deriveTruths(llm, "obj");
    expect(truths[0].groundedIn).toEqual(["obs1", "obs2"]);
  });

  it("omits the CANDIDATE OBSERVATIONS block when no survey is passed", async () => {
    let capturedPrompt: string | undefined;
    const llm = (async (req: LlmRequest<unknown>) => {
      capturedPrompt = req.prompt;
      return { truths: [] };
    }) as unknown as Llm;
    await deriveTruths(llm, "obj");
    expect(capturedPrompt).not.toContain("CANDIDATE OBSERVATIONS");
  });

  it("renders survey observations as evidence-not-premises when passed", async () => {
    let capturedPrompt: string | undefined;
    const llm = (async (req: LlmRequest<unknown>) => {
      capturedPrompt = req.prompt;
      return { truths: [] };
    }) as unknown as Llm;
    const survey: Observation[] = [
      { id: "obs1", kind: "genre-convention", statement: "explainers open with a hook", source: "creator handbooks" },
    ];
    await deriveTruths(llm, "obj", survey);
    expect(capturedPrompt).toContain("## CANDIDATE OBSERVATIONS (evidence, not premises — reject freely, cite if used)");
    expect(capturedPrompt).toContain("obs1 [genre-convention] explainers open with a hook (creator handbooks)");
  });

  it("instructs the model on groundedIn semantics in the system prompt", async () => {
    let capturedSystem: string | undefined;
    const llm = (async (req: LlmRequest<unknown>) => {
      capturedSystem = req.system;
      return { truths: [] };
    }) as unknown as Llm;
    await deriveTruths(llm, "obj");
    expect(capturedSystem).toContain(
      "groundedIn lists the observation ids a truth rests on; empty for truths derived by reasoning alone."
    );
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
