# Claude Agent SDK + Opus 4.8 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every single AI call in the framework (generation-time and inside emitted packages) through the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) running `claude-opus-4-8`, and remove the OpenAI SDK entirely.

**Architecture:** This plan **depends on** `2026-07-02-mechanism-over-theater.md` being executed first — that plan funnels all LLM traffic through one `Llm` function type (`src/llm/gateway.ts`), so this migration is: add a Claude Agent SDK-backed factory implementing the same `Llm` type, swap the two production construction sites (CLI + runtime entry point), update the emitted package's dependencies, delete the OpenAI factory. Every unit test from Plan 1 keeps passing unchanged because they inject fake `Llm` functions — that's the proof the abstraction held.

**Tech Stack:** `@anthropic-ai/claude-agent-sdk` (TypeScript, Node 18+), `zod` + `zod-to-json-schema` (Llm schema → SDK `outputFormat` JSON schema), vitest, dotenv.

## Global Constraints

- **Every AI call goes through the Agent SDK's `query()`** — no `openai` imports, no `@anthropic-ai/sdk` (raw API client) imports, no `fetch` to model endpoints, anywhere, including the emitted runtime. The user's requirement is explicit: Agent SDK, not raw API calls.
- **Model: `"claude-opus-4-8"` exactly** (valid full model id — no date suffix). Parameterized only in the gateway factory default.
- Auth: `ANTHROPIC_API_KEY` (the Agent SDK does not auto-load `.env`; our entry points call `dotenv.config()` before constructing the gateway, which populates `process.env` for the SDK's subprocess). `OPEN_AI_TOKEN` references are removed.
- The `Llm` / `LlmRequest<T>` interface from Plan 1 is **frozen** — do not change its shape; only the backing implementation changes.
- Pure text-transform calls: `allowedTools: []`, `maxTurns: 1`, custom `systemPrompt` string (never the `claude_code` preset — that's a coding-agent prompt), structured output via `outputFormat: {type: "json_schema", schema}`. Parsed result is read from the result message's `structured_output` field and re-validated with zod before returning (belt and braces; keeps the `Llm` contract "returns validated `T`").
- Known tradeoff, accepted per the user's explicit requirement: the Agent SDK spawns a bundled CLI subprocess per `query()` (~100–500ms overhead vs a raw API client). If throughput ever becomes a problem, the SDK's `startup()` pre-warm exists — do NOT add it speculatively (YAGNI).
- API shape facts used below (verified against docs at plan time — re-verify against the installed SDK's TypeScript types during Task 1, the compiler is the authority): `query({prompt, options})` returns an async generator; the final message has `type === "result"`; success carries `subtype === "success"` and `structured_output`; structured-output failure carries `subtype === "error_max_structured_output_retries"` and `errors`.

---

### Task 1: Claude Agent SDK gateway

**Files:**
- Modify: `package.json` (add `@anthropic-ai/claude-agent-sdk`, `zod-to-json-schema`)
- Create: `src/llm/claudeGateway.ts`
- Test: `tests/llm/claudeGateway.test.ts`

**Interfaces:**
- Consumes: `Llm`, `LlmRequest` from `src/llm/gateway` (Plan 1, Task 4).
- Produces: `makeClaudeAgentSdkLlm(opts?: { model?: string; queryFn?: typeof query }): Llm`. `queryFn` is injectable so tests never spawn the CLI subprocess. Default model `"claude-opus-4-8"`.

- [ ] **Step 1: Install dependencies**

Run: `yarn add @anthropic-ai/claude-agent-sdk zod-to-json-schema`
Expected: both land in `dependencies`.

- [ ] **Step 2: Check the installed SDK's types before writing code**

Open `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` (or the package's exported `.d.ts`) and confirm these exact names, adjusting the implementation in Step 5 if they differ: `query` export; `options.model`, `options.systemPrompt`, `options.allowedTools`, `options.maxTurns`, `options.outputFormat`; result message `type: "result"`, `subtype: "success"`, `structured_output`, `errors`. The compiler is the source of truth over this plan's prose.

- [ ] **Step 3: Write failing tests (fake queryFn — no subprocess, no network)**

```typescript
// tests/llm/claudeGateway.test.ts
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `yarn test tests/llm/claudeGateway.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the gateway**

```typescript
// src/llm/claudeGateway.ts
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

/**
 * Llm implementation backed by the Claude Agent SDK. Every call is a
 * single-turn, tool-less, structured-output query — the SDK's agent loop is
 * intentionally not used; this framework's own pipeline is the loop.
 */
export function makeClaudeAgentSdkLlm(opts: ClaudeGatewayOptions = {}): Llm {
  const model = opts.model ?? "claude-opus-4-8";
  const queryFn = opts.queryFn ?? query;

  return async <T>({ system, prompt, schema, schemaName }: LlmRequest<T>): Promise<T> => {
    const jsonSchema = zodToJsonSchema(schema, { target: "openAi" }) as Record<string, unknown>;

    const stream = queryFn({
      prompt,
      options: {
        model,
        systemPrompt: system ?? DEFAULT_SYSTEM,
        allowedTools: [], // pure text transform — no tools, no file access
        maxTurns: 1,
        outputFormat: { type: "json_schema", schema: jsonSchema },
      },
    });

    for await (const message of stream as AsyncIterable<any>) {
      if (message.type !== "result") continue;
      if (message.subtype === "success" && message.structured_output != null) {
        // Re-validate: the Llm contract promises a zod-validated T.
        return schema.parse(message.structured_output);
      }
      const detail = message.errors ? `: ${JSON.stringify(message.errors)}` : "";
      throw new Error(
        `Claude Agent SDK returned ${message.subtype} for schema "${schemaName}"${detail}`
      );
    }
    throw new Error(`Claude Agent SDK produced no result message for schema "${schemaName}"`);
  };
}
```

Note on `zodToJsonSchema(..., { target: "openAi" })`: this target emits closed objects (`additionalProperties: false`), which structured-output engines require. If the installed `zod-to-json-schema` version doesn't support that target string, use the default target and pass `{ $refStrategy: "none" }` — structured outputs don't support recursive `$ref`s.

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test tests/llm/claudeGateway.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Run the full suite (Plan 1 tests must be untouched and green)**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json yarn.lock src/llm/claudeGateway.ts tests/llm/claudeGateway.test.ts
git commit -m "feat: Claude Agent SDK gateway implementing the Llm interface on claude-opus-4-8"
```

---

### Task 2: Swap production call sites and the emitted package

**Files:**
- Modify: `src/scripts/agentGenerator.ts` (imports + env check + gateway construction)
- Modify: `src/runtime/main.ts` (same)
- Modify: `src/core/emit.ts` (emitted `package.json` dependencies)
- Test: `tests/core/emit.test.ts` (update the dependency assertion)

**Interfaces:**
- Consumes: `makeClaudeAgentSdkLlm` from Task 1.
- Produces: no new interfaces — the `llm` passed into `generateOntology` / `runOntology` is now Agent-SDK-backed. Emitted packages depend on `@anthropic-ai/claude-agent-sdk`, `zod`, `zod-to-json-schema`, `dotenv` — versions **copied from the generator's own `package.json`** so they can never drift.

- [ ] **Step 1: Update the CLI entry point**

In `src/scripts/agentGenerator.ts`, replace the OpenAI construction block:

```typescript
// REMOVE:
import OpenAI from "openai";
import { makeOpenAiLlm } from "../llm/gateway";
// ...
const token = process.env.OPEN_AI_TOKEN;
if (!token) {
  console.error("OPEN_AI_TOKEN is not set.");
  process.exit(1);
}
const llm = makeOpenAiLlm(new OpenAI({ apiKey: token }));

// ADD:
import { makeClaudeAgentSdkLlm } from "../llm/claudeGateway";
// ...
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Add it to .env or the environment.");
  process.exit(1);
}
const llm = makeClaudeAgentSdkLlm();
```

(`dotenv.config()` at the top of the file stays — it populates `process.env` before the SDK subprocess inherits it.)

- [ ] **Step 2: Update the runtime entry point the same way**

In `src/runtime/main.ts`, apply the identical swap: remove the `openai` import and `OPEN_AI_TOKEN` check; add the `claudeGateway` import, the `ANTHROPIC_API_KEY` check with the same error message, and `const llm = makeClaudeAgentSdkLlm();`.

- [ ] **Step 3: Update the emit test's dependency expectations first (failing test)**

In `tests/core/emit.test.ts`, replace the package.json assertion lines:

```typescript
    const pkgJson = fs.readJsonSync(path.join(pkgDir, "package.json"));
    expect(pkgJson.scripts["run-agents"]).toBeDefined();
    expect(pkgJson.dependencies["@anthropic-ai/claude-agent-sdk"]).toBeDefined();
    expect(pkgJson.dependencies["zod-to-json-schema"]).toBeDefined();
    expect(pkgJson.dependencies.openai).toBeUndefined();
```

Run: `yarn test tests/core/emit.test.ts`
Expected: FAIL — emitted package still depends on `openai`.

- [ ] **Step 4: Update emit.ts to mirror the generator's own dependency versions**

In `src/core/emit.ts`, replace the hardcoded `dependencies` object:

```typescript
  const rootPkg = fs.readJsonSync(path.join(baseDir, "package.json"));
  const mirrored = ["@anthropic-ai/claude-agent-sdk", "zod", "zod-to-json-schema", "dotenv"];
  const dependencies = Object.fromEntries(
    mirrored.map((name) => [name, rootPkg.dependencies[name]])
  );
```

and use `dependencies` in the emitted `package.json`. This keeps emitted packages pinned to whatever the generator itself runs, permanently.

- [ ] **Step 5: Run the emit test and full suite**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 6: Update README**

In `README.md`: Prerequisites → replace "OpenAI API Key" with "Anthropic API key (`ANTHROPIC_API_KEY`)"; the `.env` example becomes `ANTHROPIC_API_KEY=your-anthropic-api-key`; add one line: "All model calls run on Claude Opus 4.8 via the Claude Agent SDK."

- [ ] **Step 7: Commit**

```bash
git add src/scripts/agentGenerator.ts src/runtime/main.ts src/core/emit.ts tests/core/emit.test.ts README.md
git commit -m "feat: route generation and runtime through the Claude Agent SDK on Opus 4.8"
```

---

### Task 3: Remove OpenAI entirely

**Files:**
- Modify: `src/llm/gateway.ts` (types only — delete `makeOpenAiLlm`)
- Delete: `tests/llm/gateway.test.ts` (tested only the OpenAI factory; the type has no behavior)
- Modify: `package.json` (remove `openai`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `src/llm/gateway.ts` becomes the pure contract module:

```typescript
// src/llm/gateway.ts
import { z } from "zod";

export interface LlmRequest<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
}

/** The one and only LLM entry point. Everything model-shaped goes through here. */
export type Llm = <T>(req: LlmRequest<T>) => Promise<T>;
```

- [ ] **Step 1: Rewrite `src/llm/gateway.ts` to the contract-only module above** (delete the `OpenAI` import, `zodResponseFormat` import, and `makeOpenAiLlm`).

- [ ] **Step 2: Delete the OpenAI factory's test file**

```bash
git rm tests/llm/gateway.test.ts
```

- [ ] **Step 3: Remove the dependency**

Run: `yarn remove openai`

- [ ] **Step 4: Verify nothing OpenAI-shaped remains**

Run: `grep -ri "openai\|OPEN_AI_TOKEN\|gpt-4" src/ tests/ package.json`
Expected: no matches. (If `emit.ts`'s copied-runtime assets or README snippets still match, fix them — the constraint is zero OpenAI references in the shipped code.)

Run: `grep -rn "@anthropic-ai/sdk\"" src/ package.json`
Expected: no matches — only `@anthropic-ai/claude-agent-sdk` is allowed (the raw API client would violate the every-call-through-the-Agent-SDK requirement).

- [ ] **Step 5: Build and full test suite**

Run: `yarn build && yarn test`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove OpenAI SDK — all AI calls now flow through the Claude Agent SDK"
```

---

### Task 4: Live verification (requires ANTHROPIC_API_KEY)

**Files:** none created; findings go in the commit/PR description.

- [ ] **Step 1: Confirm auth**

Ensure `.env` contains `ANTHROPIC_API_KEY=...` (console.anthropic.com). The Agent SDK does not use claude.ai subscription login for third-party apps — an API key is required for headless runs.

- [ ] **Step 2: One-call smoke before the full pipeline**

Run a single gateway call to fail fast on auth/SDK issues (cheap, seconds):

```bash
node -e '
require("dotenv").config();
const { makeClaudeAgentSdkLlm } = require("./dist/llm/claudeGateway");
const { z } = require("zod");
makeClaudeAgentSdkLlm()({
  prompt: "Return the number five as a string.",
  schema: z.object({ value: z.string() }),
  schemaName: "smoke",
}).then(r => console.log("OK", r)).catch(e => { console.error(e); process.exit(1); });
' 
```
(Build first: `yarn build`.) Expected: `OK { value: "5" }` (or similar).

- [ ] **Step 3: Full generation run**

Run: `yarn generate-agents "I want to evaluate whether a claim backed by data is based on a sufficiently rigorous study worthy of being considered true"`
Expected: same behavior as Plan 1's smoke test, now on Opus 4.8. Inspect `packages/agent-package-*/src/ontology.json` for typed truths and citations, and `package.json` for the Agent SDK dependency.

- [ ] **Step 4: Run the generated package**

```bash
cd packages/agent-package-*/ && npm install && npm run run-agents "A press release claims a supplement reduces anxiety by 40% based on a study of 12 people with no control group. Should I believe it?"
```
Expected: agents execute and a synthesized, evidence-grounded answer prints. Also run the out-of-frame haiku prompt to confirm the escape hatch still works.

- [ ] **Step 5: Cost/latency sanity note**

Each pipeline stage is now an Opus 4.8 call through a spawned subprocess. Record rough wall-clock for one generation run in the PR description so there's a baseline. If generation feels unacceptably slow, the levers (in order) are: the SDK's `startup()` pre-warm, and per-call `effort` if/when the SDK exposes it — do not implement either without measuring first.

- [ ] **Step 6: SDK best-practices verification**

Dispatch the `agent-sdk-dev:agent-sdk-verifier-ts` agent over the repo to check the Agent SDK usage follows current SDK conventions; apply anything it flags that is real.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: adjustments from live Claude Agent SDK verification"
```
(Skip if clean.)

---

## Self-Review Notes

- **Requirement coverage:** every AI call through the Agent SDK (T1 gateway + T2 both entry points + T2 emitted deps + T3 grep proves no other path), Opus 4.8 pinned (T1 default + tests), OpenAI fully removed (T3). The emitted runtime uses the same `claudeGateway.ts` because `emit.ts` copies `src/llm/` verbatim (Plan 1's emit design) — after T1–T3 that directory contains only the contract + the Claude gateway.
- **Type consistency:** `Llm`/`LlmRequest` unchanged from Plan 1; `makeClaudeAgentSdkLlm` signature consistent across T1 (definition), T2 (both call sites); emit dependency list (T2 Step 4) matches the deps added in T1 Step 1 plus Plan 1's `zod`/`dotenv`.
- **Judgment calls:** (a) injectable `queryFn` instead of module mocking — matches Plan 1's DI style and keeps tests subprocess-free; (b) zod re-validation on top of SDK-side schema enforcement — cheap, and preserves the gateway contract exactly; (c) SDK option names are verified against the installed package's `.d.ts` in T1 Step 2 rather than trusted from research — the compiler wins any conflict with this document.
