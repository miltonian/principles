# research-pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bare Opus-with-web vs. Principles-compiled teams on 10 seeded ResearchRubrics tasks, graded by Scale's unmodified Gemini grader, per `docs/superpowers/specs/2026-07-03-research-pilot-design.md`.

**Architecture:** `src/bench/researchLoader.ts` (fetch/parse/sample), `src/bench/researchArms.ts` (two arm runners over the existing gateway: `generateOntology` + `runOntology` for ours, one `webTools: true` call for bare), `src/scripts/researchPilot.ts` CLI. Artifacts under `benchmarks/research-pilot/`.

**Tech Stack:** Existing repo stack; no new dependencies; Python only at the operator-run grading step (their repo, documented commands).

## Global Constraints

- No changes to `src/shared/`, `src/llm/`, `src/runtime/`, `src/core/`. New schemaName `bench_report` only.
- Seeded determinism (mulberry32 copy in researchLoader; seed 20260703); no `Math.random`, no bare `new Date()` in `src/bench/`.
- Dataset: HF `ScaleAI/researchrubrics`. Fetch via the datasets-server rows API (`https://datasets-server.huggingface.co/rows?dataset=ScaleAI%2Fresearchrubrics&config=default&split=train&offset=<n>&length=100`, paginate until empty rows or offset ≥ 200; rows[].row has `prompt`, `sample_id`, `rubrics`). Cache raw pages in `.bench-cache/researchrubrics/`.
- Responses are grader-ready: exactly `benchmarks/research-pilot/responses/<arm>/<sample_id>.md`, file content = the report markdown only.
- CLI is resumable (existing response file ⇒ skip) and cost-guarded (`--yes`).
- Model: gateway default (`claude-opus-4-8`) both arms. Bare arm sets `webTools: true`; principles arm sets nothing (web flows only through judged `needsWeb` flags).
- Branch `framework-bench`. `yarn build && yarn test` green at every commit.

---

### Task F1: Loader — fetch pages, parse, seeded sample, manifest

**Files:**
- Create: `src/bench/researchLoader.ts`
- Test: `tests/bench/researchLoader.test.ts`

**Interfaces (Produces):**

```typescript
export interface ResearchTask { sampleId: string; prompt: string; rubricCount: number; }
export interface PilotManifest { dataset: string; seed: number; count: number; items: { sampleId: string; rubricCount: number }[]; }
export function mulberry32(seed: number): () => number;                                  // same algorithm as the swe bench branch (documented copy)
export function parseRowsPages(pages: string[]): ResearchTask[];                         // each page: JSON with rows[].row.{sample_id,prompt,rubrics[]}; skips rows missing sample_id/prompt; rubricCount = rubrics.length
export function sampleTasks(tasks: ResearchTask[], count: number, seed: number): ResearchTask[]; // sort by sampleId, Fisher-Yates with mulberry32, slice(0, count)
export function buildPilotManifest(tasks: ResearchTask[], seed: number): PilotManifest;  // dataset fixed "ScaleAI/researchrubrics"
```

- [ ] **Step 1: Failing tests** (`tests/bench/researchLoader.test.ts`):

```typescript
import { describe, expect, it } from "vitest";
import { buildPilotManifest, parseRowsPages, sampleTasks } from "../../src/bench/researchLoader";

const page = (rows: unknown[]) => JSON.stringify({ rows: rows.map((row) => ({ row })) });

describe("parseRowsPages", () => {
  it("parses tasks across pages and counts rubrics", () => {
    const p1 = page([{ sample_id: "b", prompt: "P-b", rubrics: [{ criterion: "c", weight: 5, axis: "a" }] }]);
    const p2 = page([{ sample_id: "a", prompt: "P-a", rubrics: [] }, { prompt: "no id" }]);
    const tasks = parseRowsPages([p1, p2]);
    expect(tasks.map((t) => t.sampleId)).toEqual(["b", "a"]);
    expect(tasks[0].rubricCount).toBe(1);
  });
});

describe("sampleTasks", () => {
  const mk = (id: string) => ({ sampleId: id, prompt: `P-${id}`, rubricCount: 1 });
  const pool = ["e", "d", "c", "b", "a"].map(mk);
  it("is deterministic under a fixed seed and caps at count", () => {
    const a = sampleTasks(pool, 3, 42).map((t) => t.sampleId);
    const b = sampleTasks(pool, 3, 42).map((t) => t.sampleId);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(sampleTasks(pool, 99, 42)).toHaveLength(5);
  });
});

describe("buildPilotManifest", () => {
  it("records dataset, seed, count and per-item rubric counts", () => {
    const m = buildPilotManifest([{ sampleId: "x", prompt: "p", rubricCount: 7 }], 9);
    expect(m).toEqual({ dataset: "ScaleAI/researchrubrics", seed: 9, count: 1, items: [{ sampleId: "x", rubricCount: 7 }] });
  });
});
```

- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement** — mulberry32 identical to the swe branch's (comment: "copy of the swe-judge-bench loader's PRNG; that branch is parked"); `parseRowsPages` JSON-parses each page, iterates `rows[].row`, skips rows lacking `sample_id` or `prompt`; `sampleTasks` sorts by sampleId, one shared mulberry32 stream, Fisher-Yates, slice; `buildPilotManifest` literal mapping.
- [ ] **Step 4: GREEN + full suite.**
- [ ] **Step 5: Commit** — `git add src/bench/researchLoader.ts tests/bench/researchLoader.test.ts && git commit -m "feat: research-pilot loader — HF rows parsing, seeded task sample"`

---

### Task F2: Arms — bare call and in-process Principles pipeline

**Files:**
- Create: `src/bench/researchArms.ts`
- Test: `tests/bench/researchArms.test.ts`

**Interfaces:**
- Consumes: `Llm` (`src/llm/gateway`), `generateOntology` (`src/core/pipeline`), `runOntology` (`src/runtime/orchestrator`), `ResearchTask` (F1).
- Produces:

```typescript
export interface ArmResponse { sampleId: string; arm: "bare" | "principles"; markdown: string; wordCount: number; unverified: string[]; }
export const BARE_WRAPPER = "Respond with a comprehensive research report in Markdown.";
export async function runBareArm(llm: Llm, task: ResearchTask): Promise<ArmResponse>;
export interface PrinciplesRunners {                     // injected for tests; realRunners() wires the real functions
  generate(llm: Llm, objective: string): Promise<{ ontology: unknown }>;
  run(llm: Llm, ontology: unknown, prompt: string): Promise<{ answer: string; unverified: string[] }>;
}
export function realRunners(): PrinciplesRunners;
export async function runPrinciplesArm(llm: Llm, task: ResearchTask, runners?: PrinciplesRunners): Promise<ArmResponse>;
```

- [ ] **Step 1: Failing tests**:

```typescript
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
    expect(r.wordCount).toBe(3);
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
```

- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement** — bare arm: `schema: z.object({ report: z.string() })`, `schemaName: "bench_report"`, `webTools: true`, prompt = `${task.prompt}\n\n${BARE_WRAPPER}`, no system override; wordCount = `markdown.trim().split(/\s+/).length`. Principles arm: `runners ?? realRunners()`; `generate(llm, task.prompt)` then `run(llm, report.ontology, task.prompt)`; markdown = `answer`; unverified passthrough. `realRunners()` returns `{ generate: generateOntology, run: runOntology }` (typed via the real signatures; the interface's `unknown` keeps tests fake-friendly).
- [ ] **Step 4: GREEN + full suite.**
- [ ] **Step 5: Commit** — `git commit -m "feat: research-pilot arms — bare web call vs in-process compiled team"`

---

### Task F3: CLI — fetch/run/status, resumable, cost-guarded

**Files:**
- Create: `src/scripts/researchPilot.ts`
- Modify: `package.json` (add `"research-pilot": "yarn build && node dist/scripts/researchPilot.js"`)
- Test: `tests/scripts/researchPilot.test.ts`

**Interfaces:** `export async function run(argv: string[], deps: PilotDeps): Promise<number>` with `PilotDeps { llm; fetchText(url); readFile; writeFile; appendFile; exists; mkdirp; listDir(p): string[]; log; error; confirmYes; runners? }` (runners passthrough so tests inject the fake pipeline). Mirror the sweBench/judgeDiff harness style exactly.

Subcommands:
- `fetch`: paginate rows API (offset 0,100 — dataset is 101 rows; stop on empty/`offset ≥ 200`), cache pages, `sampleTasks(tasks, 10, 20260703)`, refuse to overwrite `benchmarks/research-pilot/manifest.json` if any `responses/*/` files exist (exit 2 naming them), else write manifest; print count + per-task rubric counts.
- `run --arm bare|principles [--limit N]`: load manifest + cached pages (error 2 with "run fetch first" if missing); items whose `responses/<arm>/<sampleId>.md` exists are skipped; refuse without `--yes` printing the remaining count; per item: run the arm, write the response file, append a line to `benchmarks/research-pilot/run-log-<arm>.jsonl` (`{sampleId, wordCount, unverified, at}` — `at` from an injected `now()` in deps, defaulting in require.main to `() => new Date().toISOString()`); log word count + unverified per item as it goes.
- `status`: per arm, done/total counts from the responses dirs.
- Exit codes 0/2. require.main mirrors judgeDiff (dotenv, warn-not-exit, `makeClaudeAgentSdkLlm()`, node fs/fetch).

- [ ] **Step 1: Failing tests** — harness style as before: (a) fetch writes manifest with 10 items from 2 faked pages of 12 tasks and refuses when a response file exists; (b) run without `--yes` → exit 2, zero arm invocations, message has remaining count; (c) run bare with `confirmYes` → writes `responses/bare/<id>.md` whose content equals the fake report markdown, appends one log line per item, skips pre-existing response files (arm invoked n−1 times); (d) run principles uses injected runners (no real pipeline import in tests) and records unverified in the log line; (e) status reports done/total; (f) unknown subcommand → 2. Write full test code following `tests/scripts/sweBench.test.ts` patterns (that file is on the parked branch — mirror `tests/scripts/judgeDiff.test.ts` in THIS branch instead for deps/harness conventions).
- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement.** Response file content = markdown only (no front-matter — grader reads the file raw).
- [ ] **Step 4: GREEN + full suite; `yarn build`.**
- [ ] **Step 5: Commit** — `git commit -m "feat: yarn research-pilot — fetch/run/status, resumable grader-ready responses"`

---

### Task F4: Live — fetch, smoke, full run (controller-run per live-verification skill)

- [ ] **Step 1:** `yarn research-pilot fetch` → verify manifest: 10 items, seed 20260703; commit manifest ("feat: pilot manifest — 10 seeded ResearchRubrics tasks, committed pre-run").
- [ ] **Step 2:** Smoke: `run --arm bare --limit 1 --yes` then `--arm principles --limit 1 --yes` (background launcher, watchdog envs, log to file). Read both responses end-to-end by eye: bare is a real report using web; principles output is a coherent report, `[caution]`/unverified state noted in the run log. Fix anything broken (TDD) before continuing.
- [ ] **Step 3:** Full runs in background, sequential arms (`run --arm bare --yes`, then `--arm principles --yes`); stage-probe = `status` + run-log line counts. Expect the principles arm to take hours (10 compiles); resumable on interruption.
- [ ] **Step 4:** Commit responses + run logs ("feat: pilot responses — both arms, 10 tasks").

### Task F5: Live — grade with their grader, scoreboard, publish (controller-run; needs user's GEMINI_API_KEY)

- [ ] **Step 1:** Clone `scaleapi/researchrubrics` into `.bench-cache/grader/`; follow its README to grade `responses/bare/` and `responses/principles/` (config: GA Gemini snapshot; key from env). If the key is missing, stop and ask the user — do not substitute a different judge model.
- [ ] **Step 2:** Copy each arm's grader output into `benchmarks/research-pilot/grading/<arm>/`; spot-check 5 rubric verdicts by hand against the responses.
- [ ] **Step 3:** Write `benchmarks/research-pilot/README.md`: weighted score per arm (their formula), per-task table, word counts per arm, published baselines quoted for context (different systems/dates — labeled), the decision rule from the spec, pilot caveats (n=10, single seed, subscription-run generation). Whatever the numbers are, they ship.
- [ ] **Step 4:** Final whole-branch review (fable) → fixes → PR → merge per standing authorization. Then: decision conversation with the user about the competitor round.

---

## Self-Review Notes

- **Spec coverage:** loader/sample/manifest (F1), both arms incl. webTools & in-process pipeline (F2), CLI resumable/guarded + grader-ready files (F3), live runs (F4), neutral grading + scoreboard + gate (F5).
- **Placeholder scan:** clean; F1/F2 fully coded; F3 prescriptive against an in-branch template (judgeDiff harness).
- **Type consistency:** `ResearchTask` F1→F2/F3; `ArmResponse` F2→F3; `PrinciplesRunners` injection keeps the real pipeline out of unit tests; `bench_report` only new schemaName.
- **Judgment calls:** in-process runtime justified by invariant 3 (verbatim-copied dirs ⇒ in-repo ≡ shipped); `unverified` recorded in run logs and surfaced in the README (the system's honesty flags are part of the result, not noise); fetch-overwrite refusal reuses the stale-mixing lesson from the swe-bench review.
