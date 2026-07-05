import { describe, it, expect } from "vitest";
import { surveyLandscape } from "../../src/core/survey";
import { Llm, LlmRequest } from "../../src/llm/gateway";

describe("surveyLandscape", () => {
  it("requests landscape_survey with webTools true", async () => {
    const captured: { req?: LlmRequest<unknown> } = {};
    const llm = (async (req: LlmRequest<unknown>) => {
      captured.req = req;
      return { observations: [] };
    }) as unknown as Llm;

    await surveyLandscape(llm, "make a YouTube explainer on rip currents");
    expect(captured.req!.schemaName).toBe("landscape_survey");
    expect(captured.req!.webTools).toBe(true);
  });

  it("assigns sequential obsN ids in code, not from the model", async () => {
    const llm = (async () => ({
      observations: [
        { kind: "genre-convention", statement: "explainers open with a hook", source: "creator handbooks" },
        { kind: "topic-axis", statement: "rip current science spans oceanography and lifeguarding practice", source: "NOAA" },
      ],
    })) as unknown as Llm;

    const observations = await surveyLandscape(llm, "obj");
    expect(observations.map((o) => o.id)).toEqual(["obs1", "obs2"]);
    expect(observations[0].kind).toBe("genre-convention");
    expect(observations[1].kind).toBe("topic-axis");
  });

  it("returns an empty list as-is", async () => {
    const llm = (async () => ({ observations: [] })) as unknown as Llm;
    const observations = await surveyLandscape(llm, "obj");
    expect(observations).toEqual([]);
  });

  it("preserves statement and source verbatim", async () => {
    const llm = (async () => ({
      observations: [{ kind: "topic-axis", statement: "S", source: "Src" }],
    })) as unknown as Llm;
    const [o] = await surveyLandscape(llm, "obj");
    expect(o.statement).toBe("S");
    expect(o.source).toBe("Src");
  });
});
