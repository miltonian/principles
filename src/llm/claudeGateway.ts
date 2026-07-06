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

// Hard per-attempt wall-clock. Live evidence (v4 large-payload runs): under API
// degradation the SDK stream can WEDGE — no message, no error, no end — stalling
// a run forever. The CLAUDE_STREAM_IDLE_TIMEOUT_MS env watchdog did not abort it.
// This timer is the backstop: a wedged attempt rejects and the retry loop resamples.
// Read per-call (not at module load) so tests and ops can tune it via env.
const attemptTimeoutMs = (): number => Number(process.env.PRINCIPLES_ATTEMPT_TIMEOUT_MS) || 300_000;

// Backoff between whole-query retries (see the retry loop for why). Env-tunable
// so tests run instant and ops can widen it when the API is degraded.
const backoffBaseMs = (): number => {
  const raw = process.env.PRINCIPLES_BACKOFF_BASE_MS;
  return raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : 1000;
};

// Maximum turns per query. Tools are disabled (tools: [], allowedTools: []),
// so extra turns only continue the same text/structured-output generation
// without agent-loop risk. Single turn (1) is too tight — live runs showed
// legitimate 2-turn completions and an error_max_turns failure on long
// decompositions. Allow 4 to be safe.
const MAX_TURNS = 4;

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

    // Per-attempt AbortController is THE way to terminate a query's underlying
    // `claude` subprocess (SDK Options.abortController: "when aborted, the query
    // will stop and clean up resources"). iterator.return() does NOT kill it —
    // orphaned subprocesses accumulated into a throughput death spiral until we
    // switched to this. See the retry loop's abort call.
    const runQuery = (abortController: AbortController): AsyncIterable<any> =>
      queryFn({
        prompt,
        options: {
          model,
          systemPrompt: system ?? DEFAULT_SYSTEM,
          abortController,
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

      let timer: ReturnType<typeof setTimeout> | undefined;
      // Hoisted so `finally` can .return() it. CRITICAL: a timed-out or
      // errored attempt must tell the async iterator to clean up, which
      // terminates the SDK's underlying `claude` subprocess. Without this,
      // timed-out calls ORPHAN their subprocess — it keeps running for
      // minutes, consuming API capacity, and retries pile more orphans on
      // top: a self-inflicted throughput death spiral (diagnosed live —
      // 9-minute zombie subprocesses under concurrency 1).
      let iterator: AsyncIterator<any> | undefined;
      const abortController = new AbortController();
      try {
        iterator = runQuery(abortController)[Symbol.asyncIterator]();
        const ms = attemptTimeoutMs();
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`attempt timed out after ${ms}ms (wedged stream) for schema "${schemaName}"`)),
            ms
          );
        });
        for (;;) {
          const next = await Promise.race([iterator.next(), timeout]);
          if (next.done) break;
          const message = next.value;
          if (message.type !== "result") continue;
          if (message.subtype === "success" && message.structured_output != null) {
            structuredOutput = message.structured_output;
            haveOutput = true;
            break;
          }
          if (message.subtype === "success") {
            // Flake: success but the finalize step dropped structured_output.
            if (process.env.PRINCIPLES_DIAG === "1") {
              const { structured_output, ...rest } = message;
              // eslint-disable-next-line no-console
              console.error(
                `[DIAG empty-success ${schemaName} attempt ${attempt}] ${JSON.stringify(rest).slice(0, 1500)}`
              );
            }
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
        // with code 1"), or the attempt timed out on a wedged stream.
        lastError = err instanceof Error ? err : new Error(String(err));
      } finally {
        if (timer) clearTimeout(timer);
        // Terminate the SDK subprocess on any non-success exit (timeout/error).
        // abort() is the SDK's documented cancel — it stops the query and cleans
        // up the underlying `claude` subprocess, so it can't orphan and pile up.
        // Also best-effort .return() the iterator to release the async generator.
        if (!haveOutput) {
          abortController.abort();
          if (iterator?.return) {
            void Promise.resolve(iterator.return(undefined)).catch(() => {
              /* best-effort teardown */
            });
          }
        }
      }

      if (haveOutput) {
        // Re-validate outside the retry try/catch: a zod failure here means
        // the SDK validated but our zod disagrees — a real error, propagated
        // immediately, never retried.
        return schema.parse(structuredOutput);
      }

      // Diagnosed live: hitting the account's usage limit does NOT surface as a
      // clean rate-limit error — it returns subtype "success" with no
      // structured_output, indistinguishable from a finalize flake. Immediate
      // retries then burn all attempts against a ceiling that persists for
      // seconds. Exponential backoff (1s,2s,4s,8s) lets a transient limit/overload
      // clear before the next attempt instead of hammering it.
      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = backoffBaseMs() * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    throw new Error(`after ${MAX_ATTEMPTS} attempts, ${lastError!.message}`);
  };
}
