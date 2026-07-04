import { describe, it, expect } from "vitest";
import { runAgent } from "../../src/runtime/agent";
import { Blackboard } from "../../src/runtime/blackboard";
import { AgentSpec } from "../../src/shared/types";
import { Llm, LlmRequest } from "../../src/llm/gateway";

const spec: AgentSpec = {
  id: "agent-s1", name: "Analyzer", subtaskId: "s1",
  instructions: "analyze the input", servesTruths: ["t1"],
  dependsOn: [], outputHint: "a structured analysis",
};

const fakeLlm = (capture: { req?: LlmRequest<unknown> }): Llm =>
  (async (req: LlmRequest<unknown>) => {
    capture.req = req;
    return { notes: "reasoning notes", result: "the analysis" };
  }) as unknown as Llm;

describe("runAgent", () => {
  it("gives the agent the user prompt, its instructions, and the full blackboard", async () => {
    const board = new Blackboard();
    board.add({ agentId: "agent-s0", subtask: "prior", notes: "prior nuance", result: "prior result" });
    const capture: { req?: LlmRequest<unknown> } = {};
    const out = await runAgent(fakeLlm(capture), spec, "the user prompt", board);
    expect(out).toEqual({ notes: "reasoning notes", result: "the analysis" });
    expect(capture.req!.prompt).toContain("the user prompt");
    expect(capture.req!.prompt).toContain("prior nuance"); // full board, not just deps
    expect(capture.req!.system).toContain("analyze the input");
  });

  it("includes improvement notes on retries", async () => {
    const capture: { req?: LlmRequest<unknown> } = {};
    await runAgent(fakeLlm(capture), spec, "p", new Blackboard(), "previous attempt lacked citations");
    expect(capture.req!.prompt).toContain("previous attempt lacked citations");
  });

  it("passes webTools through and announces web capability in the system prompt", async () => {
    const capture: { req?: LlmRequest<unknown> } = {};
    const webSpec = { ...spec, webTools: true };
    await runAgent(fakeLlm(capture), webSpec, "p", new Blackboard());
    expect(capture.req!.webTools).toBe(true);
    expect(capture.req!.system).toContain("web search");
  });

  it("coalesces missing notes to empty string and accepts result-only payloads (live: finalize failed fitting two report-sized strings)", async () => {
    const capture: { req?: LlmRequest<unknown> } = {};
    const resultOnlyLlm = (async (req: LlmRequest<unknown>) => {
      capture.req = req;
      return { result: "the analysis" };
    }) as unknown as Llm;
    const out = await runAgent(resultOnlyLlm, spec, "p", new Blackboard());
    expect(out).toEqual({ result: "the analysis", notes: "" });
    const schema = capture.req!.schema as { parse: (v: unknown) => unknown };
    expect(() => schema.parse({ result: "r" })).not.toThrow();
    expect(() => schema.parse({})).toThrow();
    expect(capture.req!.system).toContain("Keep notes under 200 words");
  });

  it("omits webTools and the web line for tool-less agents", async () => {
    const capture: { req?: LlmRequest<unknown> } = {};
    await runAgent(fakeLlm(capture), spec, "p", new Blackboard());
    expect(capture.req!.webTools).toBeUndefined();
    expect(capture.req!.system ?? "").not.toContain("web search");
  });
});
