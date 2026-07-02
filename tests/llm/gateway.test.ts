import { describe, it, expect } from "vitest";
import { z } from "zod";
import { makeOpenAiLlm } from "../../src/llm/gateway";

const fakeClient = (parsed: unknown, capture?: { args?: any }) =>
  ({
    beta: {
      chat: {
        completions: {
          parse: async (args: any) => {
            if (capture) capture.args = args;
            return { choices: [{ message: { parsed } }] };
          },
        },
      },
    },
  }) as any;

describe("makeOpenAiLlm", () => {
  it("returns the parsed structured output", async () => {
    const llm = makeOpenAiLlm(fakeClient({ answer: "42" }));
    const result = await llm({
      prompt: "q",
      schema: z.object({ answer: z.string() }),
      schemaName: "test",
    });
    expect(result).toEqual({ answer: "42" });
  });

  it("passes model, system and user messages through", async () => {
    const capture: { args?: any } = {};
    const llm = makeOpenAiLlm(fakeClient({ answer: "x" }, capture), "gpt-4o-mini");
    await llm({
      system: "sys",
      prompt: "user-q",
      schema: z.object({ answer: z.string() }),
      schemaName: "test",
    });
    expect(capture.args.model).toBe("gpt-4o-mini");
    expect(capture.args.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "user-q" },
    ]);
    expect(capture.args.response_format).toBeDefined();
  });

  it("throws when the model returns nothing parseable", async () => {
    const llm = makeOpenAiLlm(fakeClient(null));
    await expect(
      llm({ prompt: "q", schema: z.object({ a: z.string() }), schemaName: "t" })
    ).rejects.toThrow(/no parsed output/i);
  });
});
