import { describe, expect, it } from "vitest";
import { BARE_WRAPPER, runBareArm, runPrinciplesArm } from "../../src/bench/researchArms";
import type { LlmRequest } from "../../src/llm/gateway";

const task = { sampleId: "t-1", prompt: "Analyze the market for X.", rubricCount: 3 };

describe("runBareArm", () => {
  it("makes one webTools call containing the task verbatim and returns the report", async () => {
    const log: LlmRequest<unknown>[] = [];
    const llm = (async (req: LlmRequest<never>) => { log.push(req as LlmRequest<unknown>); return { report: "# R\nbody here" }; }) as never;
    const r = await runBareArm(llm, task);
    expect(log).toHaveLength(1);
    expect(log[0].webTools).toBe(true);
    expect(log[0].schemaName).toBe("bench_report");
    expect(log[0].prompt).toContain("Analyze the market for X.");
    expect(log[0].prompt).toContain(BARE_WRAPPER);
    expect(r).toMatchObject({ sampleId: "t-1", arm: "bare", markdown: "# R\nbody here", unverified: [] });
    expect(r.wordCount).toBe(4);
  });
});

describe("runPrinciplesArm", () => {
  it("generates from the task prompt as goal, runs it, and carries unverified ids", async () => {
    const calls: string[] = [];
    const runners = {
      generate: async (_llm: never, objective: string) => { calls.push(`gen:${objective}`); return { ontology: { o: 1 } }; },
      run: async (_llm: never, ontology: never, prompt: string) => { calls.push(`run:${prompt}`); return { answer: "# Answer", unverified: ["agent-s2"] }; },
    };
    const r = await runPrinciplesArm({} as never, task, runners as never);
    expect(calls).toEqual(["gen:Analyze the market for X.", "run:Analyze the market for X."]);
    expect(r).toMatchObject({ sampleId: "t-1", arm: "principles", markdown: "# Answer", unverified: ["agent-s2"] });
  });
});
