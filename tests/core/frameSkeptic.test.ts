import { describe, it, expect } from "vitest";
import { challengeFrame } from "../../src/core/frameSkeptic";
import { Llm, LlmRequest } from "../../src/llm/gateway";
import { Observation } from "../../src/shared/types";

describe("challengeFrame", () => {
  it("requests frame_challenges, tool-less, with objective + survey + frameSummary in the prompt", async () => {
    const captured: { req?: LlmRequest<unknown> } = {};
    const llm = (async (req: LlmRequest<unknown>) => {
      captured.req = req;
      return { challenges: [] };
    }) as unknown as Llm;

    const survey: Observation[] = [
      { id: "obs1", kind: "genre-convention", statement: "explainers open with a hook", source: "creator handbooks" },
    ];
    const frameSummary = ["- s1: analyze sources", "", "Coverage map:", "- source credibility: handled by s1"].join("\n");

    await challengeFrame(llm, "make a YouTube explainer", survey, frameSummary);

    expect(captured.req!.schemaName).toBe("frame_challenges");
    expect(captured.req!.webTools).toBeFalsy();
    expect(captured.req!.prompt).toContain("make a YouTube explainer");
    expect(captured.req!.prompt).toContain("obs1 [genre-convention] explainers open with a hook (creator handbooks)");
    expect(captured.req!.prompt).toContain(frameSummary);
  });

  it("assigns sequential fcN ids in code, not from the model", async () => {
    const llm = (async () => ({
      challenges: [
        { kind: "missing-axis", challenge: "no subtask covers counterarguments" },
        { kind: "wrong-genre", challenge: "reads like an essay, not an explainer script" },
      ],
    })) as unknown as Llm;

    const challenges = await challengeFrame(llm, "obj", [], "frame");
    expect(challenges.map((c) => c.id)).toEqual(["fc1", "fc2"]);
    expect(challenges[0].kind).toBe("missing-axis");
    expect(challenges[1].kind).toBe("wrong-genre");
  });

  it("returns an empty list as-is", async () => {
    const llm = (async () => ({ challenges: [] })) as unknown as Llm;
    const challenges = await challengeFrame(llm, "obj", [], "frame");
    expect(challenges).toEqual([]);
  });

  it("renders '(no survey observations)' when the survey is empty", async () => {
    const captured: { req?: LlmRequest<unknown> } = {};
    const llm = (async (req: LlmRequest<unknown>) => {
      captured.req = req;
      return { challenges: [] };
    }) as unknown as Llm;

    await challengeFrame(llm, "obj", [], "frame");
    expect(captured.req!.prompt).toContain("(no survey observations)");
  });
});

describe("challengeFrame — survey-attack license (bias safeguard 3)", () => {
  it("explicitly licenses attacking the survey's framing and denies convention authority", async () => {
    let captured = "";
    const llm = (async (req: { system?: string }) => {
      captured = req.system ?? "";
      return { challenges: [] };
    }) as never;
    const { challengeFrame } = await import("../../src/core/frameSkeptic");
    await challengeFrame(llm, "obj", [], "frame");
    expect(captured).toContain("The survey is evidence, not authority");
    expect(captured).toContain("challenge that too");
    expect(captured).toContain("not a");
  });
});
