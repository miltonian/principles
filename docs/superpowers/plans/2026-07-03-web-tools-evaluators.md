# web-tools-evaluators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generated evaluator agents get per-agent web search/fetch, gated by model-proposed + judge-verified `needsWeb` declarations, per the approved spec `docs/superpowers/specs/2026-07-03-web-tools-evaluators-design.md`.

**Architecture:** One additive field on `LlmRequest` (`webTools?: boolean`) honored only by the gateway (WebSearch/WebFetch, higher turn cap); `needsWeb`+justification proposed at decomposition, rejected mechanically when unjustified (`cov-web-justified`) and judged via a new `d-web` rubric criterion; the flag flows Subtask → AgentSpec → runAgent. Generation pipeline itself never sets it.

**Tech Stack:** Existing repo stack (TypeScript CommonJS strict, zod 3, Claude Agent SDK gateway, vitest).

## Global Constraints

- All new type fields are OPTIONAL/additive; old ontologies load unchanged as tool-less. `src/shared` and `src/llm` change but stay self-contained (no new imports/deps → no `emit.ts` change).
- Gateway: web path enables EXACTLY `["WebSearch", "WebFetch"]` for both `tools` and `allowedTools`, `maxTurns` = `WEB_MAX_TURNS = 12`; non-web path byte-identical to today (`tools: []`, `allowedTools: []`, `MAX_TURNS = 4`). Verify tool-name literals against the installed SDK `.d.ts`; the compiler is authoritative over this plan.
- Decomposition schema: `needsWeb: z.boolean()` + `webJustification: z.string()` REQUIRED in the zod schema (structured-output-safe; empty string = none).
- Coverage check id: `cov-web-justified`. Rubric criterion id: `d-web`, appended after `d-complete`, before the truth-derived criteria.
- `AgentSpec.webTools` present ONLY when true (conditional spread).
- No schemaName changes. CLAUDE.md invariant wording updates in Task 5.
- Branch `web-tools-evaluators` (from `196eeb9`). `yarn build && yarn test` green at every commit.

---

### Task 1: Gateway web-tools path

**Files:**
- Modify: `src/llm/gateway.ts` (LlmRequest field)
- Modify: `src/llm/claudeGateway.ts`
- Test: `tests/llm/claudeGateway.test.ts` (append)

**Interfaces:**
- Consumes: existing gateway internals.
- Produces: `LlmRequest.webTools?: boolean`; gateway constants `MAX_TURNS = 4` (existing), `WEB_MAX_TURNS = 12` (new, exported for tests).

- [ ] **Step 1: Add the field to `LlmRequest`** in `src/llm/gateway.ts`:

```typescript
export interface LlmRequest<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  /** When true, the backing gateway may enable web search/fetch for THIS call only. */
  webTools?: boolean;
}
```

- [ ] **Step 2: Write the failing tests (append to tests/llm/claudeGateway.test.ts)**

```typescript
import { WEB_MAX_TURNS } from "../../src/llm/claudeGateway";

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
```

- [ ] **Step 3: RED** — run the file; the first test fails (tools `[]`, maxTurns 4).

- [ ] **Step 4: Implement in `src/llm/claudeGateway.ts`**

Before writing code, grep the installed SDK types for the canonical tool names: `grep -n "WebSearch\|web_search" node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts | head -5` — use whatever literal the SDK's allowed-tools documentation uses (expected `"WebSearch"`/`"WebFetch"`; if it differs, adjust the two literals AND the test to match, noting it in your report).

```typescript
export const WEB_MAX_TURNS = 12; // web tool loops consume turns; tool-less calls keep MAX_TURNS

// inside the returned async function, replace the fixed options with:
    const webTools = req.webTools === true;
    const toolset = webTools ? ["WebSearch", "WebFetch"] : [];
    const stream = queryFn({
      prompt,
      options: {
        model,
        systemPrompt: system ?? DEFAULT_SYSTEM,
        allowedTools: toolset,
        tools: toolset,
        maxTurns: webTools ? WEB_MAX_TURNS : MAX_TURNS,
        outputFormat: { type: "json_schema", schema: jsonSchema },
      },
    });
```

(Keep `MAX_TURNS = 4` as-is; destructure `webTools` from the request alongside the other fields — adjust the destructuring line accordingly.)

- [ ] **Step 5: GREEN + full suite** — `yarn build && yarn test` green (91 + 2).

- [ ] **Step 6: Commit**

```bash
git add src/llm/gateway.ts src/llm/claudeGateway.ts tests/llm/claudeGateway.test.ts
git commit -m "feat: per-call web tools (WebSearch/WebFetch) behind LlmRequest.webTools"
```

---

### Task 2: Subtask/AgentSpec fields + decomposition proposal

**Files:**
- Modify: `src/shared/types.ts` (two optional fields)
- Modify: `src/core/decompose.ts`
- Test: `tests/core/decompose.test.ts` (append)

**Interfaces:**
- Produces: `Subtask.needsWeb?: boolean`, `Subtask.webJustification?: string`, `AgentSpec.webTools?: boolean` (types only here; specs.ts wired in Task 4).

- [ ] **Step 1: types.ts** — add to `Subtask`:

```typescript
  /** Model-proposed, judge-verified request for web search/fetch. */
  needsWeb?: boolean;
  webJustification?: string;
```

and to `AgentSpec`:

```typescript
  /** Present (true) only when the underlying subtask's web request survived judging. */
  webTools?: boolean;
```

- [ ] **Step 2: Failing tests (append to tests/core/decompose.test.ts)**

```typescript
  it("maps needsWeb and webJustification from the model output", async () => {
    const llm = fakeLlm({
      subtasks: [
        { description: "fetch the paper", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: true, webJustification: "the study text is external" },
        { description: "summarize", servesTruths: ["t1"], dependsOnIndices: [1], needsWeb: false, webJustification: "" },
      ],
    });
    const subtasks = await decompose(llm, "obj", truths, null);
    expect(subtasks[0].needsWeb).toBe(true);
    expect(subtasks[0].webJustification).toBe("the study text is external");
    expect(subtasks[1].needsWeb).toBe(false);
    expect(subtasks[1].webJustification).toBe("");
  });

  it("instructs the model about needsWeb in the prompt", async () => {
    const capture: { prompt?: string } = {};
    const llm = fakeLlm({ subtasks: [] }, capture);
    await decompose(llm, "obj", truths, null);
    expect(capture.prompt).toContain("needsWeb");
  });
```

NOTE: existing decompose tests' fake responses lack the two new required schema fields — the fake bypasses zod so they won't throw, but UPDATE the existing fakes in this file to include `needsWeb: false, webJustification: ""` anyway (fixtures should model reality).

- [ ] **Step 3: RED**, then implement in `src/core/decompose.ts`:

Schema items gain:

```typescript
      needsWeb: z.boolean(),
      webJustification: z.string(),
```

Mapping adds:

```typescript
    needsWeb: s.needsWeb,
    webJustification: s.webJustification.trim(),
```

System-prompt rules gain (after the dependsOnIndices rule):

```typescript
      "- needsWeb: set true ONLY when the subtask must fetch or search EXTERNAL material that the",
      "  user's prompt cannot be assumed to contain (e.g. retrieving a linked study). When true,",
      "  webJustification must concretely name what external material and why it is needed;",
      "  when false, webJustification is an empty string.",
```

- [ ] **Step 4: GREEN + full suite.** Also confirm the pipeline/foundations scripted fixtures still pass (they bypass zod; no change required there — Task 6's live gate covers the real schema).

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/core/decompose.ts tests/core/decompose.test.ts
git commit -m "feat: subtasks propose needsWeb with a justification at decomposition"
```

---

### Task 3: Mechanical justification check + d-web criterion

**Files:**
- Modify: `src/core/coverage.ts`
- Modify: `src/core/rubric.ts`
- Test: `tests/core/coverage.test.ts`, `tests/core/rubric.test.ts` (append)

**Interfaces:**
- Produces: `unjustifiedWeb(subtasks: Subtask[]): string[]`; `coverageCritique` verdicts array gains `cov-web-justified` (6 verdicts total); `decompositionRubric` gains `d-web` after `d-complete` and before the `d-<truthId>` criteria.

- [ ] **Step 1: Failing tests**

Append to `tests/core/coverage.test.ts`:

```typescript
  it("finds needsWeb subtasks lacking a justification", () => {
    const withWeb = (id: string, needsWeb: boolean, just: string): Subtask =>
      ({ id, description: id, servesTruths: ["t1"], dependsOn: [], needsWeb, webJustification: just });
    expect(unjustifiedWeb([withWeb("s1", true, ""), withWeb("s2", true, "fetch the linked paper"), withWeb("s3", false, "")])).toEqual(["s1"]);
  });

  it("coverageCritique includes cov-web-justified", () => {
    const crit = coverageCritique([t("t1")], [s("s1", ["t1"])]);
    expect(crit.verdicts).toHaveLength(6);
    expect(crit.verdicts.some((v) => v.criterionId === "cov-web-justified" && v.pass)).toBe(true);
  });
```

(Import `unjustifiedWeb`; the existing "coverageCritique passes a clean decomposition" test asserts `toHaveLength(5)` — update it to 6.)

Append to `tests/core/rubric.test.ts`:

```typescript
  it("decompositionRubric places d-web after d-complete, before truth criteria", () => {
    const rubric = decompositionRubric(truths);
    expect(rubric.map((c) => c.id)).toEqual(["d-minimal", "d-feasible", "d-complete", "d-web", "d-t1", "d-t3"]);
  });
```

(The existing decompositionRubric id-order test asserts the old array — update it to include `d-web`.)

- [ ] **Step 2: RED**, then implement:

`src/core/coverage.ts`:

```typescript
export function unjustifiedWeb(subtasks: Subtask[]): string[] {
  return subtasks
    .filter((s) => s.needsWeb === true && !(s.webJustification ?? "").trim())
    .map((s) => s.id);
}
```

and in `coverageCritique`'s verdicts array, after the `cov-unknown-deps` entry:

```typescript
      verdict("cov-web-justified", unjustifiedWeb(subtasks), "every web request carries a justification"),
```

`src/core/rubric.ts` — in `decompositionRubric`'s generic array, after `d-complete`:

```typescript
    { id: "d-web", source: "generic", description: "Web access (needsWeb) is requested only where the subtask genuinely requires external material, and each request's justification is concrete — not speculative convenience." },
```

- [ ] **Step 3: GREEN + full suite.** The Task-8-era pipeline scripted test's `rubric_verdicts` fake returns only d-minimal/d-feasible/d-complete/d-t1 — the judge's mechanical post-check will now auto-fail the missing `d-web` and the decomposition will... CHECK: that fixture's judge response lacking `d-web` → judge() adds a FAIL("not evaluated") → refine iterates → same → escalates. The pipeline test asserts `decomposition.status === "converged"` — IT WILL BREAK. Fix the fixtures: in `tests/core/pipeline.test.ts` AND `tests/core/foundations.test.ts` AND `tests/core/rubricCompiler.test.ts` (compileRubric test), add `{ criterionId: "d-web", pass: true, evidence: "no web requests made or all justified" }` to the decomposition-side `rubric_verdicts` fake responses. This is expected, in-scope fixture maintenance — list it in your report.

- [ ] **Step 4: Commit**

```bash
git add src/core/coverage.ts src/core/rubric.ts tests/core/coverage.test.ts tests/core/rubric.test.ts tests/core/pipeline.test.ts tests/core/foundations.test.ts tests/core/rubricCompiler.test.ts
git commit -m "feat: mechanical web-justification check and d-web rubric criterion"
```

---

### Task 4: Flag propagation — specs and runtime

**Files:**
- Modify: `src/core/specs.ts`
- Modify: `src/runtime/agent.ts`
- Test: `tests/core/specs.test.ts`, `tests/runtime/agent.test.ts` (append)

**Interfaces:**
- Produces: `AgentSpec.webTools` present only when the subtask's `needsWeb === true`; `runAgent` passes `webTools: spec.webTools` and appends the web line to the system prompt when set.

- [ ] **Step 1: Failing tests**

Append to `tests/core/specs.test.ts`:

```typescript
  it("propagates needsWeb → webTools, key absent when false", async () => {
    const webbed: Subtask[] = [
      { id: "s1", description: "fetch", servesTruths: ["t1"], dependsOn: [], needsWeb: true, webJustification: "external paper" },
      { id: "s2", description: "summarize", servesTruths: ["t1"], dependsOn: ["s1"], needsWeb: false, webJustification: "" },
    ];
    const specs = await generateAgentSpecs(fakeLlm(), "obj", truths, webbed);
    expect(specs[0].webTools).toBe(true);
    expect("webTools" in specs[1]).toBe(false);
  });
```

Append to `tests/runtime/agent.test.ts`:

```typescript
  it("passes webTools through and announces web capability in the system prompt", async () => {
    const capture: { req?: LlmRequest<unknown> } = {};
    const webSpec = { ...spec, webTools: true };
    await runAgent(fakeLlm(capture), webSpec, "p", new Blackboard());
    expect(capture.req!.webTools).toBe(true);
    expect(capture.req!.system).toContain("web search");
  });

  it("omits webTools and the web line for tool-less agents", async () => {
    const capture: { req?: LlmRequest<unknown> } = {};
    await runAgent(fakeLlm(capture), spec, "p", new Blackboard());
    expect(capture.req!.webTools).toBeUndefined();
    expect(capture.req!.system ?? "").not.toContain("web search");
  });
```

- [ ] **Step 2: RED**, then implement:

`src/core/specs.ts` — in the pushed spec object, after `dependsOn`:

```typescript
      ...(subtask.needsWeb === true ? { webTools: true } : {}),
```

and in the spec-writer prompt, add after the upstream-subtasks section:

```typescript
        ...(subtask.needsWeb
          ? [``, `## Web access`, `This agent will have web search/fetch. Justification: ${subtask.webJustification}. The instructions should direct what to retrieve and require citing URLs.`]
          : []),
```

`src/runtime/agent.ts` — in the system array, after the notes line:

```typescript
      ...(spec.webTools
        ? [`You may use web search and web fetch for this subtask. Cite the URLs you used in your notes.`]
        : []),
```

and in the `llm({...})` call:

```typescript
    ...(spec.webTools ? { webTools: true } : {}),
```

(Place it as a sibling of `system`/`prompt`/`schema`/`schemaName` — spread into the request object.)

- [ ] **Step 3: GREEN + full suite.**

- [ ] **Step 4: Commit**

```bash
git add src/core/specs.ts src/runtime/agent.ts tests/core/specs.test.ts tests/runtime/agent.test.ts
git commit -m "feat: webTools flows subtask → spec → runtime agent calls"
```

---

### Task 5: CLAUDE.md invariant updates

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1:** Invariant #1: append to the end of the sentence about the gateway: ` Gateway calls are tool-less except per-call web tools (WebSearch/WebFetch only) granted via LlmRequest.webTools — set only by runtime evaluator agents whose subtask's web request survived judging; the generation pipeline (truths, skeptic, decomposition, judging, specs, rubrics) never sets it.`
- [ ] **Step 2:** Invariant #5: append: ` Web access must be proposed with a justification at decomposition and is enforced by cov-web-justified (mechanical) and d-web (judged).`
- [ ] **Step 3:** `yarn build && yarn test` (unchanged), commit:

```bash
git add CLAUDE.md
git commit -m "docs: web-tools invariant wording"
```

---

### Task 6: Live gate (needs credentials)

**Files:** none (manual gate; findings in PR description).

- [ ] **Step 1: Regenerate the evaluator** (observably, per live-verification skill):

```bash
CLAUDE_ENABLE_STREAM_WATCHDOG=1 CLAUDE_STREAM_IDLE_TIMEOUT_MS=120000 \
  node dist/scripts/agentGenerator.js "evaluate whether a claim backed by data is based on a sufficiently rigorous study, fetching the study itself when a link or citation is provided" > webgen.log 2>&1
```

Verify in the ontology: ≥1 subtask has `needsWeb: true` with a concrete `webJustification`; the corresponding agents carry `webTools: true`; the decomposition converged (d-web judged).

- [ ] **Step 2: In-frame run with a real URL** — install/build the package and run with a prompt containing a real public-paper URL (e.g. a PLOS or arXiv abstract link) and a claim about it; verify the answer/notes cite fetched URL content and `[agents run: ...]` shows the web-flagged agents.

- [ ] **Step 3: Tool-less integrity check** — via the session-transcript probe, confirm agents WITHOUT webTools made no tool calls (grep their transcripts for `"type":"tool_use"` — expect none), and the escape hatch still answers a haiku prompt directly.

- [ ] **Step 4:** Fix anything found (TDD per fix), commit.

---

## Self-Review Notes

- **Spec coverage:** LlmRequest field + gateway mapping + WEB_MAX_TURNS (T1), Subtask/AgentSpec fields + decomposition proposal prompt/schema (T2), cov-web-justified + d-web (T3), propagation specs→runtime + prompts (T4), CLAUDE.md wording (T5), live regeneration + URL run + tool-less integrity (T6). Backward compat: all fields optional; old ontologies → webTools undefined → tool-less path (T1's second test pins it).
- **Placeholder scan:** clean.
- **Type consistency:** `webTools` spelled identically across LlmRequest/AgentSpec/runAgent/tests; `unjustifiedWeb` name matches test import; fixture-maintenance list in T3 names the three files whose `rubric_verdicts` fakes need the `d-web` pass verdict.
- **Judgment calls:** `needsWeb`/`webJustification` required in the zod schema but optional on the Subtask type (old data compat); `d-web` placed with generics so it's always judged even for zero-web decompositions (the criterion passes trivially, cheap); WEB_MAX_TURNS=12 is a starting point — the live gate validates it.
