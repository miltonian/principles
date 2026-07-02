import { describe, it, expect } from "vitest";
import { z } from "zod";
import { makeClaudeAgentSdkLlm } from "../../src/llm/claudeGateway";

/** Fake query(): captures args, yields the given messages. */
const fakeQuery = (messages: unknown[], capture?: { args?: any }) =>
  ((args: any) => {
    if (capture) capture.args = args;
    return (async function* () {
      for (const m of messages) yield m;
    })();
  }) as any;

const success = (structured: unknown) => ({
  type: "result",
  subtype: "success",
  structured_output: structured,
});

describe("makeClaudeAgentSdkLlm", () => {
  it("returns the validated structured output", async () => {
    const llm = makeClaudeAgentSdkLlm({
      queryFn: fakeQuery([{ type: "assistant" }, success({ answer: "42" })]),
    });
    const result = await llm({
      prompt: "q",
      schema: z.object({ answer: z.string() }),
      schemaName: "test",
    });
    expect(result).toEqual({ answer: "42" });
  });

  it("pins the model, disables tools, caps turns, and passes the JSON schema", async () => {
    const capture: { args?: any } = {};
    const llm = makeClaudeAgentSdkLlm({ queryFn: fakeQuery([success({ a: "x" })], capture) });
    await llm({
      system: "sys",
      prompt: "user-q",
      schema: z.object({ a: z.string() }),
      schemaName: "test",
    });
    expect(capture.args.prompt).toBe("user-q");
    expect(capture.args.options.model).toBe("claude-opus-4-8");
    expect(capture.args.options.systemPrompt).toBe("sys");
    expect(capture.args.options.allowedTools).toEqual([]);
    expect(capture.args.options.maxTurns).toBe(1);
    expect(capture.args.options.outputFormat.type).toBe("json_schema");
    expect(capture.args.options.outputFormat.schema.properties.a).toBeDefined();
  });

  it("rejects output that fails zod validation even if the SDK accepted it", async () => {
    const llm = makeClaudeAgentSdkLlm({
      queryFn: fakeQuery([success({ answer: 42 })]), // number, schema wants string
    });
    await expect(
      llm({ prompt: "q", schema: z.object({ answer: z.string() }), schemaName: "t" })
    ).rejects.toThrow();
  });

  it("throws with the SDK's errors on structured-output failure", async () => {
    const llm = makeClaudeAgentSdkLlm({
      queryFn: fakeQuery([
        {
          type: "result",
          subtype: "error_max_structured_output_retries",
          errors: [{ message: "schema mismatch" }],
        },
      ]),
    });
    await expect(
      llm({ prompt: "q", schema: z.object({ a: z.string() }), schemaName: "t" })
    ).rejects.toThrow(/error_max_structured_output_retries.*schema mismatch/s);
  });

  it("throws when the stream ends with no result message", async () => {
    const llm = makeClaudeAgentSdkLlm({ queryFn: fakeQuery([{ type: "assistant" }]) });
    await expect(
      llm({ prompt: "q", schema: z.object({ a: z.string() }), schemaName: "t" })
    ).rejects.toThrow(/no result message/i);
  });

  it("honors a model override", async () => {
    const capture: { args?: any } = {};
    const llm = makeClaudeAgentSdkLlm({
      model: "claude-opus-4-8",
      queryFn: fakeQuery([success({ a: "x" })], capture),
    });
    await llm({ prompt: "q", schema: z.object({ a: z.string() }), schemaName: "t" });
    expect(capture.args.options.model).toBe("claude-opus-4-8");
  });
});
