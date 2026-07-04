import { describe, it, expect } from "vitest";
import { z } from "zod";
import { makeClaudeAgentSdkLlm, WEB_MAX_TURNS } from "../../src/llm/claudeGateway";

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

/**
 * Fake query() that returns a different message sequence on each successive
 * call — for exercising the whole-query retry loop. Once `sequences` is
 * exhausted, the last sequence repeats.
 */
const fakeQuerySequence = (sequences: unknown[][], capture?: { calls: number }) => {
  let call = 0;
  return ((_args: any) => {
    const seq = sequences[Math.min(call, sequences.length - 1)];
    call++;
    if (capture) capture.calls = call;
    return (async function* () {
      for (const m of seq) yield m;
    })();
  }) as any;
};

/**
 * Fake query() whose returned stream THROWS during iteration on the first
 * call (simulating "Claude Code process exited with code 1"), then yields
 * the given messages on subsequent calls.
 */
const fakeQueryThrowsOnFirstCall = (messages: unknown[], capture?: { calls: number }) => {
  let call = 0;
  return ((_args: any) => {
    call++;
    const thisCall = call;
    if (capture) capture.calls = call;
    return (async function* () {
      if (thisCall === 1) {
        throw new Error("Claude Code process exited with code 1");
      }
      for (const m of messages) yield m;
    })();
  }) as any;
};

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
    expect(capture.args.options.maxTurns).toBe(4);
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

  it("strips the $schema key from the JSON schema passed to the SDK", async () => {
    const capture: { args?: any } = {};
    const llm = makeClaudeAgentSdkLlm({
      queryFn: fakeQuery([success({ a: "x" })], capture),
    });
    await llm({
      prompt: "q",
      schema: z.object({ a: z.string() }),
      schemaName: "test",
    });
    expect(capture.args.options.outputFormat.schema.$schema).toBeUndefined();
    expect(capture.args.options.outputFormat.schema.properties).toBeDefined();
  });

  it("names the missing structured output on success-without-output", async () => {
    const llm = makeClaudeAgentSdkLlm({
      queryFn: fakeQuery([{ type: "result", subtype: "success" }]),
    });
    await expect(
      llm({
        prompt: "q",
        schema: z.object({ a: z.string() }),
        schemaName: "smoke",
      })
    ).rejects.toThrow(/structured.{0,10}output/i);
    // Verify the schema name appears in the error message
    try {
      await llm({
        prompt: "q",
        schema: z.object({ a: z.string() }),
        schemaName: "smoke",
      });
    } catch (e) {
      expect((e as Error).message).toMatch(/smoke/);
    }
  });

  it("retries a success-without-output flake, succeeding on the 3rd attempt", async () => {
    const capture = { calls: 0 };
    const llm = makeClaudeAgentSdkLlm({
      queryFn: fakeQuerySequence(
        [
          [{ type: "result", subtype: "success" }],
          [{ type: "result", subtype: "success" }],
          [success({ a: "x" })],
        ],
        capture
      ),
    });
    const result = await llm({
      prompt: "q",
      schema: z.object({ a: z.string() }),
      schemaName: "t",
    });
    expect(result).toEqual({ a: "x" });
    expect(capture.calls).toBe(3);
  });

  it("retries when the query stream throws (subprocess crash), succeeding on the 2nd attempt", async () => {
    const capture = { calls: 0 };
    const llm = makeClaudeAgentSdkLlm({
      queryFn: fakeQueryThrowsOnFirstCall([success({ a: "x" })], capture),
    });
    const result = await llm({
      prompt: "q",
      schema: z.object({ a: z.string() }),
      schemaName: "t",
    });
    expect(result).toEqual({ a: "x" });
    expect(capture.calls).toBe(2);
  });

  it("gives up after MAX_ATTEMPTS (3) when structured_output never arrives", async () => {
    const capture = { calls: 0 };
    const llm = makeClaudeAgentSdkLlm({
      queryFn: fakeQuerySequence([[{ type: "result", subtype: "success" }]], capture),
    });
    let error: Error | undefined;
    try {
      await llm({ prompt: "q", schema: z.object({ a: z.string() }), schemaName: "t" });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error!.message).toMatch(/after 3 attempts/);
    expect(error!.message).toMatch(/structured_output|structured output/i);
    expect(capture.calls).toBe(3);
  });

  it("does not retry a non-success result subtype — the SDK already retried internally", async () => {
    const capture = { calls: 0 };
    const llm = makeClaudeAgentSdkLlm({
      queryFn: fakeQuerySequence(
        [
          [
            {
              type: "result",
              subtype: "error_during_execution",
              errors: [{ message: "boom" }],
            },
          ],
        ],
        capture
      ),
    });
    await expect(
      llm({ prompt: "q", schema: z.object({ a: z.string() }), schemaName: "t" })
    ).rejects.toThrow(/error_during_execution/);
    expect(capture.calls).toBe(1);
  });

  it("retries error_max_structured_output_retries with a fresh query (live: finalize converges on resample)", async () => {
    const capture = { calls: 0 };
    const llm = makeClaudeAgentSdkLlm({
      queryFn: fakeQuerySequence(
        [
          [
            {
              type: "result",
              subtype: "error_max_structured_output_retries",
              errors: [{ message: "must have required property 'notes'" }],
            },
          ],
          [success({ a: "landed" })],
        ],
        capture
      ),
    });
    const out = await llm({ prompt: "q", schema: z.object({ a: z.string() }), schemaName: "t" });
    expect(out).toEqual({ a: "landed" });
    expect(capture.calls).toBe(2);
  });
});

describe("webTools option", () => {
  it("enables exactly WebSearch and WebFetch with the web turn cap", async () => {
    const capture: { args?: any } = {};
    const llm = makeClaudeAgentSdkLlm({ queryFn: fakeQuery([success({ a: "x" })], capture) });
    await llm({ prompt: "q", schema: z.object({ a: z.string() }), schemaName: "t", webTools: true });
    expect(capture.args.options.tools).toEqual(["WebSearch", "WebFetch"]);
    expect(capture.args.options.allowedTools).toEqual(["WebSearch", "WebFetch"]);
    expect(capture.args.options.maxTurns).toBe(WEB_MAX_TURNS);
  });

  it("stays byte-identical tool-less when webTools is absent", async () => {
    const capture: { args?: any } = {};
    const llm = makeClaudeAgentSdkLlm({ queryFn: fakeQuery([success({ a: "x" })], capture) });
    await llm({ prompt: "q", schema: z.object({ a: z.string() }), schemaName: "t" });
    expect(capture.args.options.tools).toEqual([]);
    expect(capture.args.options.allowedTools).toEqual([]);
    expect(capture.args.options.maxTurns).toBe(4);
  });
});
