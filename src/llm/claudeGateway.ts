import { query } from "@anthropic-ai/claude-agent-sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Llm, LlmRequest } from "./gateway";

type QueryFn = typeof query;

export interface ClaudeGatewayOptions {
  model?: string;
  /** Injectable for tests — production uses the real Agent SDK query(). */
  queryFn?: QueryFn;
}

const DEFAULT_SYSTEM =
  "You are a precise assistant. Produce only the requested structured data.";

// Total attempts (not extra retries) at the whole query before giving up.
// Live testing shows the Agent SDK CLI's structured-output finalize step
// occasionally flakes — a success result arrives with `structured_output`
// undefined, the stream ends with no result message at all, or the CLI
// subprocess throws (observed: "Claude Code process exited with code 1").
// Identical retried calls succeed, so we retry the whole query bounded.
// 3 proved too tight in live v3/v4 runs: the flake arrives in bursts (three
// consecutive misses on one call observed twice, killing multi-hour runs).
const MAX_ATTEMPTS = 5;

// Maximum turns per query. Tools are disabled (tools: [], allowedTools: []),
// so extra turns only continue the same text/structured-output generation
// without agent-loop risk. Single turn (1) is too tight — live runs showed
// legitimate 2-turn completions and an error_max_turns failure on long
// decompositions. 4 sufficed for Opus, but Sonnet 5 chunks long generations
// across more turns (live: error_max_turns(4) on a report-sized agent_output).
const MAX_TURNS = 8;

// Web tool loops consume turns fetching/searching before finalizing structured
// output, so they need far more headroom than the tool-less MAX_TURNS above.
export const WEB_MAX_TURNS = 12;

/** Thrown for outcomes that must propagate immediately, never retried. */
class NonRetryableSdkError extends Error {}

/**
 * Llm implementation backed by the Claude Agent SDK. Every call is a
 * single-turn, tool-less, structured-output query — the SDK's agent loop is
 * intentionally not used; this framework's own pipeline is the loop.
 */
export function makeClaudeAgentSdkLlm(opts: ClaudeGatewayOptions = {}): Llm {
  const model = opts.model ?? "claude-opus-4-8";
  const queryFn = opts.queryFn ?? query;

  return async <T>({ system, prompt, schema, schemaName, webTools }: LlmRequest<T>): Promise<T> => {
    // `schema` is `z.ZodType<T>` with a generic, unresolved `T` here; passing it
    // directly to zodToJsonSchema's `ZodSchema<any>` parameter makes TS try to
    // fully instantiate ZodType<T>'s structural type and blow the recursion
    // limit (TS2589). Cast through `any` — zodToJsonSchema only inspects the
    // runtime `_def`, so this is safe.
    const jsonSchema = zodToJsonSchema(schema as any, { target: "openAi" }) as Record<
      string,
      unknown
    >;
    // The Agent SDK CLI silently ignores outputFormat when a $schema meta-key is present (verified live).
    delete jsonSchema["$schema"];

    const webToolsEnabled = webTools === true;
    const toolset = webToolsEnabled ? ["WebSearch", "WebFetch"] : [];

    const runQuery = (): AsyncIterable<any> =>
      queryFn({
        prompt,
        options: {
          model,
          systemPrompt: system ?? DEFAULT_SYSTEM,
          // Belt-and-suspenders tool disablement: `allowedTools: []` only
          // means "auto-allow nothing" (per the installed SDK's own docs,
          // it does not restrict which tools are *available*). `tools: []`
          // is the field that actually disables the built-in toolset — pure
          // text transform, no tools, no file access.
          allowedTools: toolset,
          tools: toolset,
          maxTurns: webToolsEnabled ? WEB_MAX_TURNS : MAX_TURNS,
          outputFormat: { type: "json_schema", schema: jsonSchema },
        },
      }) as AsyncIterable<any>;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let structuredOutput: unknown;
      let haveOutput = false;

      try {
        for await (const message of runQuery()) {
          if (message.type !== "result") continue;
          if (message.subtype === "success" && message.structured_output != null) {
            structuredOutput = message.structured_output;
            haveOutput = true;
            break;
          }
          if (message.subtype === "success") {
            // Flake: success but the finalize step dropped structured_output.
            lastError = new Error(
              `Claude Agent SDK returned success but no structured_output for schema "${schemaName}" — outputFormat was likely ignored`
            );
            break;
          }
          const detail = message.errors ? `: ${JSON.stringify(message.errors)}` : "";
          if (message.subtype === "error_max_structured_output_retries") {
            // Live evidence (research-pilot smoke): on report-sized payloads the
            // finalize can burn all internal attempts while visibly converging
            // (payloads shrank attempt-over-attempt). A fresh query resamples and
            // usually lands — retry at our level instead of failing the agent.
            lastError = new Error(
              `Claude Agent SDK returned ${message.subtype} for schema "${schemaName}"${detail}`
            );
            break;
          }
          // Other non-success subtypes: the SDK already retried internally —
          // surface immediately, do not retry the whole query on top of that.
          throw new NonRetryableSdkError(
            `Claude Agent SDK returned ${message.subtype} for schema "${schemaName}"${detail}`
          );
        }
        if (!haveOutput && lastError === undefined) {
          // Flake: stream ended with no result message at all.
          lastError = new Error(
            `Claude Agent SDK produced no result message for schema "${schemaName}"`
          );
        }
      } catch (err) {
        if (err instanceof NonRetryableSdkError) throw err;
        // Flake: queryFn/stream threw (observed: "Claude Code process exited
        // with code 1").
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      if (haveOutput) {
        // Re-validate outside the retry try/catch: a zod failure here means
        // the SDK validated but our zod disagrees — a real error, propagated
        // immediately, never retried.
        return schema.parse(structuredOutput);
      }
    }

    throw new Error(`after ${MAX_ATTEMPTS} attempts, ${lastError!.message}`);
  };
}
