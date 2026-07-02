# Mechanism Over Theater: Principles Framework Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every unverifiable narrative element in the framework (untyped truths, re-roll "refinement", rubric-less judging, frozen codegen pipelines) with checkable mechanisms, so decomposition quality is enforced by code and critique loops instead of vibes.

**Architecture:** A generation-time pipeline (`src/core/`) derives *typed, adversarially-vetted* truths, decomposes into subtasks that must cite the truths they serve (coverage is computed in pure code), and refines via a critique-fed loop with fixed-point termination. The output is a **data artifact** (`ontology.json`) plus a copied generic runtime (`src/runtime/`) — no code generation. The runtime does per-prompt triage/planning against the ontology, executes agents over a shared blackboard in dependency levels, and judges outputs against a rubric derived from the truths.

**Tech Stack:** TypeScript (CommonJS, strict), OpenAI SDK ^4.70 with zod structured outputs (`openai/helpers/zod`), zod, vitest for tests, fs-extra, dotenv.

## Global Constraints

- Node 18+ (vitest requirement; README currently says 14+ — update it).
- TypeScript `strict: true`, `module: commonjs` (existing `tsconfig.json` — do not change module system).
- Package manager: yarn (repo has `yarn.lock`).
- **Every LLM call in the entire codebase goes through the single `Llm` gateway type in `src/llm/gateway.ts`.** No direct `openai` imports anywhere else.
- All LLM responses use structured outputs (`zodResponseFormat`) — never "please return valid JSON" prompting followed by `JSON.parse`.
- All prompts live next to the function that uses them; no prompt text in templates/string-built source files.
- No code generation. Generated packages contain `ontology.json` + copied runtime source, never LLM-text-interpolated TypeScript.
- Default model for all calls in this plan: `"gpt-4o"` (structured-outputs capable). Model choice is parameterized in the gateway factory only. (A separate follow-up plan swaps the provider; keep the surface small.)
- Env var: `OPEN_AI_TOKEN` (existing name; keep for now).
- Existing dirs `src/prompt-decomposition-agents/`, `src/agent-planner-agents/`, `src/agent-planner-config/`, `src/user-agent-objective-agents/`, `src/user-agent-objective-config/`, `src/templates/`, `src/services/`, `src/scaffold/`, `src/llms/`, `src/utils/`, `src/types/` are deleted in Task 12 — do not modify them in earlier tasks; build the new world alongside, then cut over.

---

### Task 1: Test harness, shared types, and dependency graph

**Files:**
- Modify: `package.json` (add vitest, zod; add `test` script)
- Create: `src/shared/types.ts`
- Create: `src/shared/graph.ts`
- Test: `tests/shared/graph.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: all shared domain types (`Truth`, `TruthType`, `Subtask`, `Criterion`, `CriterionVerdict`, `Critique`, `failures()`, `AgentSpec`, `Ontology`) and `topoLevels(nodes: {id: string; dependsOn: string[]}[]): string[][] | null` (null = cycle). Every later task imports from these two files with exactly these names.

- [ ] **Step 1: Install dev/runtime deps**

Run: `yarn add zod && yarn add -D vitest`
Expected: `package.json` gains `zod` in dependencies, `vitest` in devDependencies.

- [ ] **Step 2: Add test script**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write the shared types (no test needed — pure declarations plus one trivial helper)**

```typescript
// src/shared/types.ts

export type TruthType = "fact" | "assumption" | "constraint" | "definition";

/** A typed, falsifiable claim about the problem domain. */
export interface Truth {
  id: string; // "t1", "t2", ...
  type: TruthType;
  statement: string;
  rationale: string;
}

/** A unit of decomposition. Must cite the truths it serves. */
export interface Subtask {
  id: string; // "s1", "s2", ...
  description: string;
  servesTruths: string[]; // Truth ids
  dependsOn: string[]; // Subtask ids
}

/** One evaluation criterion in a rubric. */
export interface Criterion {
  id: string;
  description: string;
  source: "truth" | "generic";
  truthId?: string; // set when source === "truth"
}

/** A judge's verdict on one criterion. Evidence is mandatory. */
export interface CriterionVerdict {
  criterionId: string;
  pass: boolean;
  evidence: string;
}

export interface Critique {
  verdicts: CriterionVerdict[];
}

export const failures = (c: Critique): CriterionVerdict[] =>
  c.verdicts.filter((v) => !v.pass);

/** Runtime-executable agent specification. Pure data — no code. */
export interface AgentSpec {
  id: string; // "agent-s1", ...
  name: string;
  subtaskId: string;
  instructions: string;
  servesTruths: string[];
  dependsOn: string[]; // AgentSpec ids
  outputHint: string;
}

/** The compiled artifact a generated package runs from. */
export interface Ontology {
  objective: string;
  truths: Truth[];
  assumptions: Truth[]; // demoted truths, surfaced to the user
  subtasks: Subtask[];
  agents: AgentSpec[];
  outputRubric: Criterion[];
}
```

- [ ] **Step 4: Write failing tests for topoLevels**

```typescript
// tests/shared/graph.test.ts
import { describe, it, expect } from "vitest";
import { topoLevels } from "../../src/shared/graph";

describe("topoLevels", () => {
  it("puts independent nodes in level 0", () => {
    const levels = topoLevels([
      { id: "a", dependsOn: [] },
      { id: "b", dependsOn: [] },
    ]);
    expect(levels).toEqual([["a", "b"]]);
  });

  it("orders dependents after dependencies, grouped by level", () => {
    const levels = topoLevels([
      { id: "a", dependsOn: [] },
      { id: "b", dependsOn: ["a"] },
      { id: "c", dependsOn: ["a"] },
      { id: "d", dependsOn: ["b", "c"] },
    ]);
    expect(levels).toEqual([["a"], ["b", "c"], ["d"]]);
  });

  it("returns null on a cycle", () => {
    const levels = topoLevels([
      { id: "a", dependsOn: ["b"] },
      { id: "b", dependsOn: ["a"] },
    ]);
    expect(levels).toBeNull();
  });

  it("ignores dependencies on unknown ids (validated elsewhere)", () => {
    const levels = topoLevels([{ id: "a", dependsOn: ["ghost"] }]);
    expect(levels).toEqual([["a"]]);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `yarn test`
Expected: FAIL — cannot resolve `../../src/shared/graph`.

- [ ] **Step 6: Implement topoLevels (Kahn's algorithm with level grouping)**

```typescript
// src/shared/graph.ts

export interface GraphNode {
  id: string;
  dependsOn: string[];
}

/**
 * Kahn's algorithm grouped into parallel-executable levels.
 * Returns null if the graph contains a cycle.
 * Dependencies on unknown ids are ignored (coverage checks flag them).
 */
export function topoLevels(nodes: GraphNode[]): string[][] | null {
  const known = new Set(nodes.map((n) => n.id));
  const level = new Map<string, number>();
  const remaining = new Map(
    nodes.map((n) => [n.id, n.dependsOn.filter((d) => known.has(d) && d !== n.id)])
  );

  let progressed = true;
  while (remaining.size > 0 && progressed) {
    progressed = false;
    for (const [id, deps] of [...remaining]) {
      if (deps.every((d) => level.has(d))) {
        const lvl = deps.length === 0 ? 0 : Math.max(...deps.map((d) => level.get(d)!)) + 1;
        level.set(id, lvl);
        remaining.delete(id);
        progressed = true;
      }
    }
  }
  if (remaining.size > 0) return null; // cycle

  const levels: string[][] = [];
  for (const n of nodes) {
    const lvl = level.get(n.id)!;
    (levels[lvl] ??= []).push(n.id);
  }
  return levels;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `yarn test`
Expected: PASS (4 tests).

- [ ] **Step 8: Verify the whole project still builds**

Run: `yarn build`
Expected: compiles (old code untouched, new files compile).

- [ ] **Step 9: Commit**

```bash
git add package.json yarn.lock src/shared tests
git commit -m "feat: add shared domain types, topoLevels, and vitest harness"
```

---

### Task 2: Coverage checks (pure, computable enforcement of truths)

**Files:**
- Create: `src/core/coverage.ts`
- Test: `tests/core/coverage.test.ts`

**Interfaces:**
- Consumes: `Truth`, `Subtask`, `Critique` from `src/shared/types`; `topoLevels` from `src/shared/graph`.
- Produces: `orphanTruths(truths, subtasks): string[]`, `unmooredSubtasks(subtasks): string[]`, `unknownCitations(truths, subtasks): string[]`, `unknownDependencies(subtasks): string[]`, `hasCycle(subtasks): boolean`, and `coverageCritique(truths: Truth[], subtasks: Subtask[]): Critique` (criterion ids: `cov-orphan-truths`, `cov-unmoored`, `cov-unknown-citations`, `cov-unknown-deps`, `cov-cycle`). Task 8's pipeline calls `coverageCritique` as the mechanical (free, deterministic) first stage of judging.

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/coverage.test.ts
import { describe, it, expect } from "vitest";
import {
  orphanTruths, unmooredSubtasks, unknownCitations,
  unknownDependencies, hasCycle, coverageCritique,
} from "../../src/core/coverage";
import { Truth, Subtask, failures } from "../../src/shared/types";

const t = (id: string): Truth => ({ id, type: "constraint", statement: id, rationale: "" });
const s = (id: string, serves: string[], deps: string[] = []): Subtask =>
  ({ id, description: id, servesTruths: serves, dependsOn: deps });

describe("coverage checks", () => {
  it("finds truths no subtask serves", () => {
    expect(orphanTruths([t("t1"), t("t2")], [s("s1", ["t1"])])).toEqual(["t2"]);
  });

  it("finds subtasks citing no truths", () => {
    expect(unmooredSubtasks([s("s1", []), s("s2", ["t1"])])).toEqual(["s1"]);
  });

  it("finds citations of unknown truth ids", () => {
    expect(unknownCitations([t("t1")], [s("s1", ["t1", "t9"])])).toEqual(["t9"]);
  });

  it("finds dependencies on unknown subtask ids", () => {
    expect(unknownDependencies([s("s1", ["t1"], ["s7"])])).toEqual(["s7"]);
  });

  it("detects cycles", () => {
    expect(hasCycle([s("s1", ["t1"], ["s2"]), s("s2", ["t1"], ["s1"])])).toBe(true);
    expect(hasCycle([s("s1", ["t1"]), s("s2", ["t1"], ["s1"])])).toBe(false);
  });

  it("coverageCritique passes a clean decomposition", () => {
    const crit = coverageCritique([t("t1")], [s("s1", ["t1"])]);
    expect(failures(crit)).toEqual([]);
    expect(crit.verdicts).toHaveLength(5);
  });

  it("coverageCritique fails with evidence naming the offenders", () => {
    const crit = coverageCritique([t("t1"), t("t2")], [s("s1", ["t1", "t9"], ["s9"])]);
    const failed = failures(crit).map((f) => f.criterionId);
    expect(failed).toContain("cov-orphan-truths");
    expect(failed).toContain("cov-unknown-citations");
    expect(failed).toContain("cov-unknown-deps");
    const orphan = failures(crit).find((f) => f.criterionId === "cov-orphan-truths")!;
    expect(orphan.evidence).toContain("t2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test tests/core/coverage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/core/coverage.ts
import { Truth, Subtask, Critique } from "../shared/types";
import { topoLevels } from "../shared/graph";

export function orphanTruths(truths: Truth[], subtasks: Subtask[]): string[] {
  const cited = new Set(subtasks.flatMap((s) => s.servesTruths));
  return truths.filter((t) => !cited.has(t.id)).map((t) => t.id);
}

export function unmooredSubtasks(subtasks: Subtask[]): string[] {
  return subtasks.filter((s) => s.servesTruths.length === 0).map((s) => s.id);
}

export function unknownCitations(truths: Truth[], subtasks: Subtask[]): string[] {
  const known = new Set(truths.map((t) => t.id));
  return [...new Set(subtasks.flatMap((s) => s.servesTruths.filter((id) => !known.has(id))))];
}

export function unknownDependencies(subtasks: Subtask[]): string[] {
  const known = new Set(subtasks.map((s) => s.id));
  return [...new Set(subtasks.flatMap((s) => s.dependsOn.filter((id) => !known.has(id))))];
}

export function hasCycle(subtasks: Subtask[]): boolean {
  return topoLevels(subtasks) === null;
}

const verdict = (criterionId: string, offenders: string[], passMsg: string) => ({
  criterionId,
  pass: offenders.length === 0,
  evidence: offenders.length === 0 ? passMsg : `Offending ids: ${offenders.join(", ")}`,
});

/**
 * Mechanical critique. Free and deterministic — always run before any LLM judge.
 * An orphan truth is an uncovered requirement; an unmoored subtask is scope creep.
 */
export function coverageCritique(truths: Truth[], subtasks: Subtask[]): Critique {
  return {
    verdicts: [
      verdict("cov-orphan-truths", orphanTruths(truths, subtasks), "every truth is served by a subtask"),
      verdict("cov-unmoored", unmooredSubtasks(subtasks), "every subtask cites a truth"),
      verdict("cov-unknown-citations", unknownCitations(truths, subtasks), "all citations resolve"),
      verdict("cov-unknown-deps", unknownDependencies(subtasks), "all dependencies resolve"),
      verdict("cov-cycle", hasCycle(subtasks) ? ["dependency-cycle"] : [], "dependency graph is acyclic"),
    ],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test tests/core/coverage.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/coverage.ts tests/core/coverage.test.ts
git commit -m "feat: computable coverage checks turning truths into enforcement"
```

---

### Task 3: The refine loop (critique-fed revision with fixed-point termination)

**Files:**
- Create: `src/shared/refine.ts`
- Test: `tests/shared/refine.test.ts`

**Interfaces:**
- Consumes: `Critique`, `failures` from `src/shared/types`.
- Produces:

```typescript
export interface RefineFeedback<T> { previous: T; critique: Critique; }
export type RefineOutcome<T> =
  | { status: "converged"; result: T; iterations: number; history: Critique[] }
  | { status: "escalated"; result: T; iterations: number; history: Critique[]; stuckOn: string[] }
  | { status: "exhausted"; result: T; iterations: number; history: Critique[] };
export async function refine<T>(
  produce: (feedback: RefineFeedback<T> | null) => Promise<T>,
  judgeFn: (candidate: T) => Promise<Critique>,
  opts?: { maxIterations?: number }
): Promise<RefineOutcome<T>>;
```

Used by Task 8 (decomposition refinement) and Task 10 (runtime agent reflection). This is pure control flow — no LLM.

- [ ] **Step 1: Write failing tests**

```typescript
// tests/shared/refine.test.ts
import { describe, it, expect } from "vitest";
import { refine } from "../../src/shared/refine";
import { Critique } from "../../src/shared/types";

const pass = (id: string) => ({ criterionId: id, pass: true, evidence: "ok" });
const fail = (id: string) => ({ criterionId: id, pass: false, evidence: "bad" });
const critique = (...verdicts: ReturnType<typeof pass>[]): Critique => ({ verdicts });

describe("refine", () => {
  it("converges immediately when the first candidate passes", async () => {
    const out = await refine(
      async () => "v1",
      async () => critique(pass("c1")),
    );
    expect(out.status).toBe("converged");
    expect(out.result).toBe("v1");
    expect(out.iterations).toBe(1);
  });

  it("feeds the critique back into produce", async () => {
    const seen: (string | null)[] = [];
    let n = 0;
    const out = await refine(
      async (fb) => { seen.push(fb ? fb.previous : null); return `v${++n}`; },
      async (c) => (c === "v1" ? critique(fail("c1")) : critique(pass("c1"))),
    );
    expect(out.status).toBe("converged");
    expect(out.result).toBe("v2");
    expect(seen).toEqual([null, "v1"]); // second call received the failed attempt
  });

  it("escalates when the same criterion fails twice in a row", async () => {
    let n = 0;
    const out = await refine(
      async () => `v${++n}`,
      async () => critique(fail("c1"), pass("c2")),
    );
    expect(out.status).toBe("escalated");
    if (out.status === "escalated") expect(out.stuckOn).toEqual(["c1"]);
    expect(out.iterations).toBe(2); // detected on the second identical failure
  });

  it("does not escalate when different criteria fail each round", async () => {
    let n = 0;
    const out = await refine(
      async () => `v${++n}`,
      async (c) =>
        c === "v1" ? critique(fail("c1")) : c === "v2" ? critique(fail("c2")) : critique(pass("c1")),
    );
    expect(out.status).toBe("converged");
    expect(out.iterations).toBe(3);
  });

  it("exhausts at maxIterations", async () => {
    let n = 0;
    const out = await refine(
      async () => `v${++n}`,
      async (c) => critique(fail(`c-${c}`)), // unique criterion each time: never repeats, never passes
      { maxIterations: 3 },
    );
    expect(out.status).toBe("exhausted");
    expect(out.iterations).toBe(3);
    expect(out.history).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test tests/shared/refine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/shared/refine.ts
import { Critique, failures } from "./types";

export interface RefineFeedback<T> {
  previous: T;
  critique: Critique;
}

export type RefineOutcome<T> =
  | { status: "converged"; result: T; iterations: number; history: Critique[] }
  | { status: "escalated"; result: T; iterations: number; history: Critique[]; stuckOn: string[] }
  | { status: "exhausted"; result: T; iterations: number; history: Critique[] };

/**
 * Revision loop with memory. Termination is a fixed point of the critique,
 * not an iteration count: we stop when nothing fails (converged), when the
 * same criterion fails twice consecutively (escalated — the reviser cannot
 * fix it, so looping again is a re-roll), or at maxIterations (exhausted).
 */
export async function refine<T>(
  produce: (feedback: RefineFeedback<T> | null) => Promise<T>,
  judgeFn: (candidate: T) => Promise<Critique>,
  opts: { maxIterations?: number } = {}
): Promise<RefineOutcome<T>> {
  const maxIterations = opts.maxIterations ?? 5;
  const history: Critique[] = [];
  let feedback: RefineFeedback<T> | null = null;
  let candidate!: T;

  for (let i = 1; i <= maxIterations; i++) {
    candidate = await produce(feedback);
    const critique = await judgeFn(candidate);
    history.push(critique);

    const failed = failures(critique).map((v) => v.criterionId);
    if (failed.length === 0) {
      return { status: "converged", result: candidate, iterations: i, history };
    }

    const previousFailed = history.length > 1
      ? new Set(failures(history[history.length - 2]).map((v) => v.criterionId))
      : new Set<string>();
    const stuckOn = failed.filter((id) => previousFailed.has(id));
    if (stuckOn.length > 0) {
      return { status: "escalated", result: candidate, iterations: i, history, stuckOn };
    }

    feedback = { previous: candidate, critique };
  }
  return { status: "exhausted", result: candidate, iterations: maxIterations, history };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test tests/shared/refine.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/refine.ts tests/shared/refine.test.ts
git commit -m "feat: refine loop — critique-fed revision with fixed-point termination and stuck-escalation"
```

---

### Task 4: The LLM gateway (single entry point, structured outputs only)

**Files:**
- Create: `src/llm/gateway.ts`
- Test: `tests/llm/gateway.test.ts`

**Interfaces:**
- Consumes: `openai` SDK, `zod`.
- Produces:

```typescript
export interface LlmRequest<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string; // [a-zA-Z0-9_-]+, required by OpenAI json_schema naming
}
export type Llm = <T>(req: LlmRequest<T>) => Promise<T>;
export function makeOpenAiLlm(client: OpenAI, model?: string): Llm; // default model "gpt-4o"
```

**Every** later task takes `llm: Llm` as an explicit parameter (dependency injection) — tests pass a fake, production passes `makeOpenAiLlm(...)`. Nothing else in the repo may import `openai`.

- [ ] **Step 1: Write failing tests (fake OpenAI client — no network)**

```typescript
// tests/llm/gateway.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test tests/llm/gateway.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/llm/gateway.ts
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

export interface LlmRequest<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
}

/** The one and only LLM entry point. Everything model-shaped goes through here. */
export type Llm = <T>(req: LlmRequest<T>) => Promise<T>;

export function makeOpenAiLlm(client: OpenAI, model = "gpt-4o"): Llm {
  return async <T>({ system, prompt, schema, schemaName }: LlmRequest<T>): Promise<T> => {
    const messages = [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      { role: "user" as const, content: prompt },
    ];
    const completion = await client.beta.chat.completions.parse({
      model,
      messages,
      response_format: zodResponseFormat(schema, schemaName),
    });
    const parsed = completion.choices[0]?.message.parsed;
    if (parsed == null) {
      throw new Error(`LLM returned no parsed output for schema "${schemaName}"`);
    }
    return parsed as T;
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test tests/llm/gateway.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/gateway.ts tests/llm/gateway.test.ts
git commit -m "feat: single Llm gateway with zod structured outputs"
```

---

### Task 5: The judge (evidence-required, default-insufficient, mechanically post-checked)

**Files:**
- Create: `src/shared/judge.ts`
- Test: `tests/shared/judge.test.ts`

**Interfaces:**
- Consumes: `Llm` from `src/llm/gateway`; `Criterion`, `Critique` from `src/shared/types`.
- Produces: `judge(llm: Llm, args: { rubric: Criterion[]; candidate: string; context: string }): Promise<Critique>`.

Mechanical spine (enforced in code, not prompt): every rubric criterion missing from the model's verdicts becomes a **fail** ("not evaluated"); any `pass` verdict with evidence shorter than 10 characters is flipped to **fail** ("no evidence provided"). This is how "evidence or it didn't happen" and "asymmetric burden of proof" become mechanisms.

- [ ] **Step 1: Write failing tests**

```typescript
// tests/shared/judge.test.ts
import { describe, it, expect } from "vitest";
import { judge } from "../../src/shared/judge";
import { Criterion, failures } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const rubric: Criterion[] = [
  { id: "c1", description: "is minimal", source: "generic" },
  { id: "c2", description: "is feasible", source: "generic" },
];

const fakeLlm = (verdicts: unknown): Llm =>
  (async () => ({ verdicts })) as unknown as Llm;

describe("judge", () => {
  it("returns the model's verdicts when complete and evidenced", async () => {
    const llm = fakeLlm([
      { criterionId: "c1", pass: true, evidence: "each subtask is one atomic action" },
      { criterionId: "c2", pass: false, evidence: "subtask s2 requires browsing the web" },
    ]);
    const critique = await judge(llm, { rubric, candidate: "cand", context: "ctx" });
    expect(critique.verdicts).toHaveLength(2);
    expect(failures(critique).map((f) => f.criterionId)).toEqual(["c2"]);
  });

  it("fails criteria the model skipped", async () => {
    const llm = fakeLlm([{ criterionId: "c1", pass: true, evidence: "long enough evidence" }]);
    const critique = await judge(llm, { rubric, candidate: "cand", context: "ctx" });
    const c2 = critique.verdicts.find((v) => v.criterionId === "c2")!;
    expect(c2.pass).toBe(false);
    expect(c2.evidence).toMatch(/not evaluated/i);
  });

  it("flips unevidenced passes to failures", async () => {
    const llm = fakeLlm([
      { criterionId: "c1", pass: true, evidence: "ok" }, // < 10 chars
      { criterionId: "c2", pass: true, evidence: "subtasks map 1:1 to text actions" },
    ]);
    const critique = await judge(llm, { rubric, candidate: "cand", context: "ctx" });
    const c1 = critique.verdicts.find((v) => v.criterionId === "c1")!;
    expect(c1.pass).toBe(false);
    expect(c1.evidence).toMatch(/no evidence/i);
  });

  it("drops verdicts for unknown criteria", async () => {
    const llm = fakeLlm([
      { criterionId: "ghost", pass: true, evidence: "irrelevant but long evidence" },
      { criterionId: "c1", pass: true, evidence: "long enough evidence here" },
      { criterionId: "c2", pass: true, evidence: "long enough evidence here" },
    ]);
    const critique = await judge(llm, { rubric, candidate: "cand", context: "ctx" });
    expect(critique.verdicts.map((v) => v.criterionId).sort()).toEqual(["c1", "c2"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test tests/shared/judge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/shared/judge.ts
import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Criterion, Critique, CriterionVerdict } from "./types";

const VerdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      criterionId: z.string(),
      pass: z.boolean(),
      evidence: z.string(),
    })
  ),
});

const MIN_EVIDENCE_CHARS = 10;

/**
 * Rubric judge. The prompt leans against sycophancy (default-insufficient,
 * criterion-by-criterion, quote evidence); the code enforces what the prompt
 * can only request: skipped criteria fail, unevidenced passes fail.
 */
export async function judge(
  llm: Llm,
  args: { rubric: Criterion[]; candidate: string; context: string }
): Promise<Critique> {
  const { rubric, candidate, context } = args;

  const raw = await llm({
    system: [
      "You are a strict evaluator. Your default position is that the candidate is INSUFFICIENT;",
      "a criterion only passes if you can argue it passes by pointing at specific content.",
      "Evaluate every criterion independently, one at a time.",
      "For each verdict, `evidence` must quote or precisely reference the part of the candidate",
      "that justifies the verdict. Unsupported praise is worthless.",
    ].join("\n"),
    prompt: [
      `## Context`,
      context,
      ``,
      `## Candidate under evaluation`,
      candidate,
      ``,
      `## Rubric — return one verdict per criterion, using these exact criterionIds`,
      ...rubric.map((c) => `- ${c.id}: ${c.description}`),
    ].join("\n"),
    schema: VerdictsSchema,
    schemaName: "rubric_verdicts",
  });

  const byId = new Map(raw.verdicts.map((v) => [v.criterionId, v]));
  const verdicts: CriterionVerdict[] = rubric.map((c) => {
    const v = byId.get(c.id);
    if (!v) return { criterionId: c.id, pass: false, evidence: "Criterion not evaluated by judge." };
    if (v.pass && v.evidence.trim().length < MIN_EVIDENCE_CHARS) {
      return { criterionId: c.id, pass: false, evidence: "Pass verdict rejected: no evidence provided." };
    }
    return v;
  });

  return { verdicts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test tests/shared/judge.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/judge.ts tests/shared/judge.test.ts
git commit -m "feat: evidence-required rubric judge with mechanical post-checks"
```

---

### Task 6: Typed truths — derivation and the adversarial skeptic

**Files:**
- Create: `src/core/truths.ts`
- Create: `src/core/skeptic.ts`
- Test: `tests/core/truths.test.ts`
- Test: `tests/core/skeptic.test.ts`

**Interfaces:**
- Consumes: `Llm`; `Truth`, `TruthType` from shared types.
- Produces:
  - `deriveTruths(llm: Llm, objective: string): Promise<Truth[]>` — ids assigned in code as `t1..tn`.
  - `vetTruths(llm: Llm, objective: string, truths: Truth[]): Promise<VetResult>` where `VetResult = { kept: Truth[]; assumptions: Truth[]; rejected: { truth: Truth; attack: string }[] }`. Demoted truths get `type: "assumption"`. Task 8 passes `kept` + `assumptions` into decomposition and surfaces `assumptions`/`rejected` to the user.

- [ ] **Step 1: Write failing tests for deriveTruths**

```typescript
// tests/core/truths.test.ts
import { describe, it, expect } from "vitest";
import { deriveTruths } from "../../src/core/truths";
import { Llm } from "../../src/llm/gateway";

const fakeLlm = (response: unknown): Llm => (async () => response) as unknown as Llm;

describe("deriveTruths", () => {
  it("assigns sequential ids in code, not from the model", async () => {
    const llm = fakeLlm({
      truths: [
        { type: "constraint", statement: "Output must be text", rationale: "LLM-only system" },
        { type: "assumption", statement: "User wants English", rationale: "Prompt is in English" },
      ],
    });
    const truths = await deriveTruths(llm, "some objective");
    expect(truths.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(truths[0].type).toBe("constraint");
  });

  it("returns an empty list as-is (pipeline decides how to react)", async () => {
    const truths = await deriveTruths(fakeLlm({ truths: [] }), "obj");
    expect(truths).toEqual([]);
  });
});
```

- [ ] **Step 2: Write failing tests for vetTruths**

```typescript
// tests/core/skeptic.test.ts
import { describe, it, expect } from "vitest";
import { vetTruths } from "../../src/core/skeptic";
import { Truth } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const truths: Truth[] = [
  { id: "t1", type: "fact", statement: "A", rationale: "" },
  { id: "t2", type: "fact", statement: "B", rationale: "" },
  { id: "t3", type: "constraint", statement: "C", rationale: "" },
];

// Returns a different attack verdict per call, in order.
const fakeLlm = (verdicts: Array<{ verdict: string; strongestAttack: string; justification: string }>): Llm => {
  let i = 0;
  return (async () => verdicts[i++]) as unknown as Llm;
};

describe("vetTruths", () => {
  it("keeps survivors, demotes to assumptions, rejects broken truths", async () => {
    const llm = fakeLlm([
      { verdict: "survives", strongestAttack: "none found", justification: "solid" },
      { verdict: "demote", strongestAttack: "only true if X", justification: "unverifiable" },
      { verdict: "reject", strongestAttack: "counterexample Y", justification: "not required" },
    ]);
    const result = await vetTruths(llm, "obj", truths);
    expect(result.kept.map((t) => t.id)).toEqual(["t1"]);
    expect(result.assumptions.map((t) => t.id)).toEqual(["t2"]);
    expect(result.assumptions[0].type).toBe("assumption"); // demoted truths change type
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].truth.id).toBe("t3");
    expect(result.rejected[0].attack).toBe("counterexample Y");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test tests/core/truths.test.ts tests/core/skeptic.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement deriveTruths**

```typescript
// src/core/truths.ts
import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Truth } from "../shared/types";

const TruthsSchema = z.object({
  truths: z.array(
    z.object({
      type: z.enum(["fact", "assumption", "constraint", "definition"]),
      statement: z.string(),
      rationale: z.string(),
    })
  ),
});

/**
 * Derive TYPED truths. The type forces the model to commit to what kind of
 * claim it is making — that commitment is what downstream stages check.
 */
export async function deriveTruths(llm: Llm, objective: string): Promise<Truth[]> {
  const result = await llm({
    system: [
      "You derive the fundamental truths underlying a user objective.",
      "Every truth must be a single, falsifiable claim — stated so that it COULD be wrong.",
      "Restating the objective is not a truth. Each truth must be typed:",
      "- fact: checkable against the world or the user's own words.",
      "- assumption: something you cannot verify and are choosing to proceed on. Be honest about these.",
      "- constraint: a rule every valid solution must obey.",
      "- definition: vocabulary that must be used consistently.",
      "Prefer fewer, sharper truths over many vague ones.",
    ].join("\n"),
    prompt: `## User objective\n${objective}\n\nDerive the typed fundamental truths.`,
    schema: TruthsSchema,
    schemaName: "typed_truths",
  });

  return result.truths.map((t, i) => ({ id: `t${i + 1}`, ...t }));
}
```

- [ ] **Step 5: Implement vetTruths**

```typescript
// src/core/skeptic.ts
import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Truth } from "../shared/types";

const AttackSchema = z.object({
  verdict: z.enum(["survives", "demote", "reject"]),
  strongestAttack: z.string(),
  justification: z.string(),
});

export interface VetResult {
  kept: Truth[];
  assumptions: Truth[]; // demoted — surfaced to the user as "proceeding as if"
  rejected: { truth: Truth; attack: string }[];
}

/**
 * Adversarial vetting: a dedicated skeptic tries to BREAK each truth.
 * In a text-only system this is the only available stand-in for reality
 * pushing back. Truths that survive are kept; unverifiable ones are demoted
 * to explicit assumptions; broken ones are rejected with the attack recorded.
 */
export async function vetTruths(llm: Llm, objective: string, truths: Truth[]): Promise<VetResult> {
  const result: VetResult = { kept: [], assumptions: [], rejected: [] };

  for (const truth of truths) {
    const attack = await llm({
      system: [
        "You are a skeptic. Your only job is to break the claim you are given:",
        "find a counterexample, a reading of the objective under which it is false,",
        "or a hidden assumption smuggled inside it. Do not be charitable.",
        "Verdicts:",
        "- survives: you genuinely could not break it.",
        "- demote: it may hold, but it is unverifiable — it is an assumption, not a truth.",
        "- reject: it is false, not required, or incoherent for this objective.",
      ].join("\n"),
      prompt: [
        `## Objective`,
        objective,
        ``,
        `## Claim under attack (type: ${truth.type})`,
        truth.statement,
        ``,
        `Rationale offered: ${truth.rationale}`,
      ].join("\n"),
      schema: AttackSchema,
      schemaName: "truth_attack",
    });

    if (attack.verdict === "survives") {
      result.kept.push(truth);
    } else if (attack.verdict === "demote") {
      result.assumptions.push({ ...truth, type: "assumption" });
    } else {
      result.rejected.push({ truth, attack: attack.strongestAttack });
    }
  }
  return result;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test tests/core/truths.test.ts tests/core/skeptic.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/core/truths.ts src/core/skeptic.ts tests/core/truths.test.ts tests/core/skeptic.test.ts
git commit -m "feat: typed truth derivation and adversarial skeptic vetting"
```

---

### Task 7: Decomposition with truth citations, and rubric builders

**Files:**
- Create: `src/core/decompose.ts`
- Create: `src/core/rubric.ts`
- Test: `tests/core/decompose.test.ts`
- Test: `tests/core/rubric.test.ts`

**Interfaces:**
- Consumes: `Llm`; `Truth`, `Subtask`, `Criterion`, `Critique`, `failures` from shared types; `RefineFeedback` from `src/shared/refine`.
- Produces:
  - `decompose(llm: Llm, objective: string, truths: Truth[], feedback: RefineFeedback<Subtask[]> | null): Promise<Subtask[]>` — this signature intentionally matches what `refine()`'s `produce` callback needs in Task 8.
  - `decompositionRubric(truths: Truth[]): Criterion[]` (pure) — generic criteria `d-minimal`, `d-feasible`, `d-complete` plus one `truth`-sourced criterion per constraint truth (id `d-<truthId>`).
  - `outputRubric(truths: Truth[]): Criterion[]` (pure) — generic `o-responsive`, `o-grounded` plus one per constraint truth (id `o-<truthId>`). Stored in the ontology; used by the runtime judge.

- [ ] **Step 1: Write failing tests for the rubric builders**

```typescript
// tests/core/rubric.test.ts
import { describe, it, expect } from "vitest";
import { decompositionRubric, outputRubric } from "../../src/core/rubric";
import { Truth } from "../../src/shared/types";

const truths: Truth[] = [
  { id: "t1", type: "constraint", statement: "Answers must cite sources", rationale: "" },
  { id: "t2", type: "fact", statement: "Domain is medical studies", rationale: "" },
  { id: "t3", type: "constraint", statement: "Output is a single report", rationale: "" },
];

describe("rubric builders", () => {
  it("decompositionRubric = generics + one criterion per constraint truth", () => {
    const rubric = decompositionRubric(truths);
    expect(rubric.map((c) => c.id)).toEqual(["d-minimal", "d-feasible", "d-complete", "d-t1", "d-t3"]);
    const dt1 = rubric.find((c) => c.id === "d-t1")!;
    expect(dt1.source).toBe("truth");
    expect(dt1.truthId).toBe("t1");
    expect(dt1.description).toContain("Answers must cite sources");
  });

  it("outputRubric = generics + one criterion per constraint truth", () => {
    const rubric = outputRubric(truths);
    expect(rubric.map((c) => c.id)).toEqual(["o-responsive", "o-grounded", "o-t1", "o-t3"]);
  });
});
```

- [ ] **Step 2: Write failing tests for decompose**

```typescript
// tests/core/decompose.test.ts
import { describe, it, expect } from "vitest";
import { decompose } from "../../src/core/decompose";
import { Truth } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const truths: Truth[] = [{ id: "t1", type: "constraint", statement: "A", rationale: "" }];

const fakeLlm = (response: unknown, capture?: { prompt?: string }): Llm =>
  (async (req: any) => {
    if (capture) capture.prompt = req.prompt;
    return response;
  }) as unknown as Llm;

describe("decompose", () => {
  it("assigns ids in code and maps dependsOnIndices to ids", async () => {
    const llm = fakeLlm({
      subtasks: [
        { description: "first", servesTruths: ["t1"], dependsOnIndices: [] },
        { description: "second", servesTruths: ["t1"], dependsOnIndices: [1] },
      ],
    });
    const subtasks = await decompose(llm, "obj", truths, null);
    expect(subtasks.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(subtasks[1].dependsOn).toEqual(["s1"]);
  });

  it("marks out-of-range dependency indices so coverage checks catch them", async () => {
    const llm = fakeLlm({
      subtasks: [{ description: "only", servesTruths: ["t1"], dependsOnIndices: [9] }],
    });
    const subtasks = await decompose(llm, "obj", truths, null);
    expect(subtasks[0].dependsOn).toEqual(["invalid:9"]);
  });

  it("includes previous attempt and failed criteria in the prompt when given feedback", async () => {
    const capture: { prompt?: string } = {};
    const llm = fakeLlm({ subtasks: [] }, capture);
    await decompose(llm, "obj", truths, {
      previous: [{ id: "s1", description: "old subtask", servesTruths: ["t1"], dependsOn: [] }],
      critique: {
        verdicts: [
          { criterionId: "d-minimal", pass: false, evidence: "s1 bundles two actions" },
          { criterionId: "d-feasible", pass: true, evidence: "all text-only" },
        ],
      },
    });
    expect(capture.prompt).toContain("old subtask");
    expect(capture.prompt).toContain("s1 bundles two actions"); // failed criterion fed back
    expect(capture.prompt).toContain("d-feasible");             // passing criterion listed as preserve
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test tests/core/rubric.test.ts tests/core/decompose.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the rubric builders**

```typescript
// src/core/rubric.ts
import { Truth, Criterion } from "../shared/types";

/** The truths ARE the rubric: constraints become criteria the judge must check. */
export function decompositionRubric(truths: Truth[]): Criterion[] {
  const generic: Criterion[] = [
    { id: "d-minimal", source: "generic", description: "Each subtask is a single atomic action that cannot be split further without losing meaning." },
    { id: "d-feasible", source: "generic", description: "Each subtask is achievable by a text-only LLM: analyzing, summarizing, drafting, reasoning. No physical actions, no external systems." },
    { id: "d-complete", source: "generic", description: "The subtasks jointly achieve the full objective; nothing the objective requires is missing." },
  ];
  const fromTruths: Criterion[] = truths
    .filter((t) => t.type === "constraint")
    .map((t) => ({
      id: `d-${t.id}`,
      source: "truth" as const,
      truthId: t.id,
      description: `The decomposition respects the constraint: "${t.statement}"`,
    }));
  return [...generic, ...fromTruths];
}

export function outputRubric(truths: Truth[]): Criterion[] {
  const generic: Criterion[] = [
    { id: "o-responsive", source: "generic", description: "The output directly addresses the user's prompt — not a generic essay near the topic." },
    { id: "o-grounded", source: "generic", description: "The output does not fabricate facts; claims are grounded in the prompt, prior agent outputs, or clearly flagged as uncertain." },
  ];
  const fromTruths: Criterion[] = truths
    .filter((t) => t.type === "constraint")
    .map((t) => ({
      id: `o-${t.id}`,
      source: "truth" as const,
      truthId: t.id,
      description: `The output satisfies the constraint: "${t.statement}"`,
    }));
  return [...generic, ...fromTruths];
}
```

- [ ] **Step 5: Implement decompose**

```typescript
// src/core/decompose.ts
import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Truth, Subtask, failures } from "../shared/types";
import { RefineFeedback } from "../shared/refine";

const DecompositionSchema = z.object({
  subtasks: z.array(
    z.object({
      description: z.string(),
      servesTruths: z.array(z.string()),
      dependsOnIndices: z.array(z.number().int()), // 1-based index into this same list
    })
  ),
});

/**
 * Decompose the objective into subtasks that CITE the truths they serve.
 * With feedback, this is a revision, not a re-roll: the previous attempt,
 * the failed criteria (with evidence), and what passed (to preserve) all
 * go into the prompt.
 */
export async function decompose(
  llm: Llm,
  objective: string,
  truths: Truth[],
  feedback: RefineFeedback<Subtask[]> | null
): Promise<Subtask[]> {
  const feedbackSection = feedback
    ? [
        ``,
        `## Previous attempt (REVISE this — do not start over)`,
        ...feedback.previous.map((s) => `- ${s.id}: ${s.description} (serves: ${s.servesTruths.join(",")}; depends: ${s.dependsOn.join(",") || "none"})`),
        ``,
        `## What failed — fix exactly these`,
        ...failures(feedback.critique).map((v) => `- ${v.criterionId}: ${v.evidence}`),
        ``,
        `## What passed — PRESERVE these properties`,
        ...feedback.critique.verdicts.filter((v) => v.pass).map((v) => `- ${v.criterionId}: ${v.evidence}`),
      ]
    : [];

  const result = await llm({
    system: [
      "You decompose an objective into minimal subtasks for text-only LLM agents.",
      "Rules:",
      "- Each subtask is one atomic action: analyze, summarize, draft, evaluate, reason.",
      "- No physical actions, no external API calls, no 'submit to' external systems.",
      "- Each subtask MUST cite the ids of the truths it serves (servesTruths).",
      "  If you cannot say which truth a subtask serves, the subtask does not belong.",
      "- dependsOnIndices: 1-based positions of subtasks whose OUTPUT this one needs.",
    ].join("\n"),
    prompt: [
      `## Objective`,
      objective,
      ``,
      `## Truths (cite these ids in servesTruths)`,
      ...truths.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`),
      ...feedbackSection,
    ].join("\n"),
    schema: DecompositionSchema,
    schemaName: "decomposition",
  });

  return result.subtasks.map((s, i) => ({
    id: `s${i + 1}`,
    description: s.description,
    servesTruths: s.servesTruths,
    dependsOn: s.dependsOnIndices.map((n) =>
      n >= 1 && n <= result.subtasks.length && n !== i + 1 ? `s${n}` : `invalid:${n}`
    ),
  }));
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test tests/core/rubric.test.ts tests/core/decompose.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/core/decompose.ts src/core/rubric.ts tests/core/decompose.test.ts tests/core/rubric.test.ts
git commit -m "feat: truth-citing decomposition and truth-derived rubric builders"
```

---

### Task 8: Agent specs and the generation pipeline

**Files:**
- Create: `src/core/specs.ts`
- Create: `src/core/pipeline.ts`
- Test: `tests/core/specs.test.ts`
- Test: `tests/core/pipeline.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7 (exact names as declared there).
- Produces:
  - `generateAgentSpecs(llm: Llm, objective: string, truths: Truth[], subtasks: Subtask[]): Promise<AgentSpec[]>` — one spec per subtask; `id = "agent-" + subtask.id`; `dependsOn` mapped from subtask deps; `servesTruths` copied from the subtask.
  - `generateOntology(llm: Llm, objective: string): Promise<GenerationReport>` where:

```typescript
export interface GenerationReport {
  ontology: Ontology;
  vet: VetResult;                       // so the CLI can print assumptions/rejections
  decomposition: RefineOutcome<Subtask[]>; // so the CLI can report converged/escalated/exhausted
}
```

Pipeline order: derive → vet → `refine(decompose, judge)` where the judge runs `coverageCritique` first (mechanical, free) and only calls the LLM judge when coverage is clean → specs → assemble `Ontology` with `outputRubric(truths)`.

- [ ] **Step 1: Write failing tests for generateAgentSpecs**

```typescript
// tests/core/specs.test.ts
import { describe, it, expect } from "vitest";
import { generateAgentSpecs } from "../../src/core/specs";
import { Truth, Subtask } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const truths: Truth[] = [{ id: "t1", type: "constraint", statement: "A", rationale: "" }];
const subtasks: Subtask[] = [
  { id: "s1", description: "analyze", servesTruths: ["t1"], dependsOn: [] },
  { id: "s2", description: "summarize", servesTruths: ["t1"], dependsOn: ["s1"] },
];

const fakeLlm = (): Llm =>
  (async () => ({ name: "Analyzer", instructions: "do the thing", outputHint: "a paragraph" })) as unknown as Llm;

describe("generateAgentSpecs", () => {
  it("derives ids, dependencies, and truth citations from the subtasks in code", async () => {
    const specs = await generateAgentSpecs(fakeLlm(), "obj", truths, subtasks);
    expect(specs.map((s) => s.id)).toEqual(["agent-s1", "agent-s2"]);
    expect(specs[1].dependsOn).toEqual(["agent-s1"]);
    expect(specs[0].servesTruths).toEqual(["t1"]);
    expect(specs[0].subtaskId).toBe("s1");
    expect(specs[0].instructions).toBe("do the thing");
  });
});
```

- [ ] **Step 2: Write failing tests for generateOntology (scripted fake Llm)**

```typescript
// tests/core/pipeline.test.ts
import { describe, it, expect } from "vitest";
import { generateOntology } from "../../src/core/pipeline";
import { Llm, LlmRequest } from "../../src/llm/gateway";

/**
 * Scripted fake: dispatches on schemaName so the test controls each stage.
 * Happy path: 1 truth survives vetting, decomposition passes the judge first try.
 */
const scriptedLlm = (): Llm =>
  (async <T>(req: LlmRequest<T>) => {
    switch (req.schemaName) {
      case "typed_truths":
        return { truths: [{ type: "constraint", statement: "must cite sources", rationale: "r" }] };
      case "truth_attack":
        return { verdict: "survives", strongestAttack: "none", justification: "solid" };
      case "decomposition":
        return { subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [] }] };
      case "rubric_verdicts":
        return {
          verdicts: [
            { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
            { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
            { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
            { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
          ],
        };
      case "agent_spec":
        return { name: "Source Analyzer", instructions: "analyze all sources", outputHint: "structured analysis" };
      default:
        throw new Error(`unexpected schema ${req.schemaName}`);
    }
  }) as unknown as Llm;

describe("generateOntology", () => {
  it("produces a full ontology on the happy path", async () => {
    const report = await generateOntology(scriptedLlm(), "evaluate study credibility");
    expect(report.decomposition.status).toBe("converged");
    expect(report.ontology.truths).toHaveLength(1);
    expect(report.ontology.subtasks).toHaveLength(1);
    expect(report.ontology.agents).toHaveLength(1);
    expect(report.ontology.agents[0].id).toBe("agent-s1");
    expect(report.ontology.outputRubric.map((c) => c.id)).toEqual(["o-responsive", "o-grounded", "o-t1"]);
    expect(report.ontology.objective).toBe("evaluate study credibility");
  });

  it("throws when every truth is rejected (nothing to build on)", async () => {
    const llm = (async <T>(req: LlmRequest<T>) => {
      if (req.schemaName === "typed_truths")
        return { truths: [{ type: "fact", statement: "x", rationale: "r" }] };
      if (req.schemaName === "truth_attack")
        return { verdict: "reject", strongestAttack: "broken", justification: "j" };
      throw new Error(`unexpected schema ${req.schemaName}`);
    }) as unknown as Llm;
    await expect(generateOntology(llm, "obj")).rejects.toThrow(/no truths survived/i);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test tests/core/specs.test.ts tests/core/pipeline.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement generateAgentSpecs**

```typescript
// src/core/specs.ts
import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Truth, Subtask, AgentSpec } from "../shared/types";

const SpecSchema = z.object({
  name: z.string(),
  instructions: z.string(),
  outputHint: z.string(),
});

/**
 * One spec per subtask. Structure (ids, dependencies, truth citations) is
 * derived in code from the subtask graph; only the prose (name, instructions,
 * outputHint) comes from the model.
 */
export async function generateAgentSpecs(
  llm: Llm,
  objective: string,
  truths: Truth[],
  subtasks: Subtask[]
): Promise<AgentSpec[]> {
  const truthById = new Map(truths.map((t) => [t.id, t]));
  const specs: AgentSpec[] = [];

  for (const subtask of subtasks) {
    const served = subtask.servesTruths
      .map((id) => truthById.get(id))
      .filter((t): t is Truth => !!t);

    const prose = await llm({
      system: [
        "You write the working instructions for one specialized text-only agent.",
        "The instructions must be self-contained, specific to the subtask, and",
        "must treat the listed truths as hard constraints the agent may not violate.",
        "outputHint describes the shape and content of what the agent should produce.",
      ].join("\n"),
      prompt: [
        `## Overall objective`,
        objective,
        ``,
        `## This agent's subtask`,
        subtask.description,
        ``,
        `## Truths this agent serves (hard constraints)`,
        ...served.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`),
        ``,
        `## Upstream subtasks whose outputs this agent will receive`,
        ...(subtask.dependsOn.length
          ? subtask.dependsOn.map((d) => `- ${d}: ${subtasks.find((s) => s.id === d)?.description ?? d}`)
          : ["- none"]),
      ].join("\n"),
      schema: SpecSchema,
      schemaName: "agent_spec",
    });

    specs.push({
      id: `agent-${subtask.id}`,
      name: prose.name,
      subtaskId: subtask.id,
      instructions: prose.instructions,
      servesTruths: [...subtask.servesTruths],
      dependsOn: subtask.dependsOn.map((d) => `agent-${d}`),
      outputHint: prose.outputHint,
    });
  }
  return specs;
}
```

- [ ] **Step 5: Implement generateOntology**

```typescript
// src/core/pipeline.ts
import { Llm } from "../llm/gateway";
import { Ontology, Subtask, failures } from "../shared/types";
import { refine, RefineOutcome } from "../shared/refine";
import { judge } from "../shared/judge";
import { deriveTruths } from "./truths";
import { vetTruths, VetResult } from "./skeptic";
import { decompose } from "./decompose";
import { coverageCritique } from "./coverage";
import { decompositionRubric, outputRubric } from "./rubric";
import { generateAgentSpecs } from "./specs";

export interface GenerationReport {
  ontology: Ontology;
  vet: VetResult;
  decomposition: RefineOutcome<Subtask[]>;
}

/**
 * derive → vet → refine(decompose ⇄ judge) → specs → ontology.
 * The decomposition judge is two-stage: mechanical coverage checks first
 * (free, deterministic); the LLM rubric judge only runs on structurally
 * sound candidates.
 */
export async function generateOntology(llm: Llm, objective: string): Promise<GenerationReport> {
  const derived = await deriveTruths(llm, objective);
  const vet = await vetTruths(llm, objective, derived);
  const truths = [...vet.kept, ...vet.assumptions];
  if (truths.length === 0) {
    throw new Error(
      `No truths survived vetting for objective "${objective}". ` +
        `Rejected: ${vet.rejected.map((r) => `${r.truth.statement} (${r.attack})`).join("; ")}`
    );
  }

  const rubric = decompositionRubric(truths);

  const decomposition = await refine<Subtask[]>(
    (feedback) => decompose(llm, objective, truths, feedback),
    async (subtasks) => {
      const mechanical = coverageCritique(truths, subtasks);
      if (failures(mechanical).length > 0) return mechanical;
      return judge(llm, {
        rubric,
        candidate: subtasks
          .map((s) => `${s.id}: ${s.description} (serves: ${s.servesTruths.join(",")}; depends: ${s.dependsOn.join(",") || "none"})`)
          .join("\n"),
        context: `Objective: ${objective}\nTruths:\n${truths.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`).join("\n")}`,
      });
    },
    { maxIterations: 5 }
  );

  const subtasks = decomposition.result;
  const agents = await generateAgentSpecs(llm, objective, truths, subtasks);

  return {
    ontology: {
      objective,
      truths: vet.kept,
      assumptions: vet.assumptions,
      subtasks,
      agents,
      outputRubric: outputRubric(truths),
    },
    vet,
    decomposition,
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test tests/core/specs.test.ts tests/core/pipeline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full suite**

Run: `yarn test`
Expected: PASS — all tests from Tasks 1–8.

- [ ] **Step 8: Commit**

```bash
git add src/core/specs.ts src/core/pipeline.ts tests/core/specs.test.ts tests/core/pipeline.test.ts
git commit -m "feat: generation pipeline — derive, vet, refine-with-coverage, specs, ontology"
```

---

### Task 9: Runtime — blackboard and the generic agent

**Files:**
- Create: `src/runtime/blackboard.ts`
- Create: `src/runtime/agent.ts`
- Test: `tests/runtime/blackboard.test.ts`
- Test: `tests/runtime/agent.test.ts`

**Interfaces:**
- Consumes: `Llm`; `AgentSpec` from shared types.
- Produces:
  - `class Blackboard` with `add(entry: BlackboardEntry): void`, `all(): BlackboardEntry[]`, `render(): string`; `BlackboardEntry = { agentId: string; subtask: string; notes: string; result: string }`.
  - `runAgent(llm: Llm, spec: AgentSpec, userPrompt: string, board: Blackboard, improvementNotes?: string): Promise<{ notes: string; result: string }>`.

Design intent: agents read the **whole** blackboard (full-fidelity prose travels; the dependency graph is for scheduling only), and they write both a structured `result` (their deliverable per `outputHint`) and free-prose `notes` (reasoning, caveats, nuance for downstream agents). This is the information-bottleneck fix.

- [ ] **Step 1: Write failing tests for Blackboard**

```typescript
// tests/runtime/blackboard.test.ts
import { describe, it, expect } from "vitest";
import { Blackboard } from "../../src/runtime/blackboard";

describe("Blackboard", () => {
  it("accumulates entries in order and renders them all", () => {
    const board = new Blackboard();
    board.add({ agentId: "agent-s1", subtask: "analyze", notes: "n1", result: "r1" });
    board.add({ agentId: "agent-s2", subtask: "summarize", notes: "n2", result: "r2" });
    expect(board.all()).toHaveLength(2);
    const rendered = board.render();
    expect(rendered.indexOf("agent-s1")).toBeLessThan(rendered.indexOf("agent-s2"));
    expect(rendered).toContain("n1");
    expect(rendered).toContain("r2");
  });

  it("renders a placeholder when empty", () => {
    expect(new Blackboard().render()).toContain("(no prior agent output yet)");
  });
});
```

- [ ] **Step 2: Write failing tests for runAgent**

```typescript
// tests/runtime/agent.test.ts
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
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test tests/runtime`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement Blackboard**

```typescript
// src/runtime/blackboard.ts

export interface BlackboardEntry {
  agentId: string;
  subtask: string;
  notes: string; // free-prose nuance for downstream agents
  result: string; // the deliverable
}

/**
 * Shared workspace. Content travels at full fidelity — the dependency graph
 * schedules execution, but it does not filter what agents can read.
 */
export class Blackboard {
  private entries: BlackboardEntry[] = [];

  add(entry: BlackboardEntry): void {
    this.entries.push(entry);
  }

  all(): BlackboardEntry[] {
    return [...this.entries];
  }

  render(): string {
    if (this.entries.length === 0) return "(no prior agent output yet)";
    return this.entries
      .map((e) =>
        [`### ${e.agentId} — ${e.subtask}`, `**Result:**`, e.result, `**Notes:**`, e.notes].join("\n")
      )
      .join("\n\n");
  }
}
```

- [ ] **Step 5: Implement runAgent**

```typescript
// src/runtime/agent.ts
import { z } from "zod";
import { Llm } from "../llm/gateway";
import { AgentSpec } from "../shared/types";
import { Blackboard } from "./blackboard";

const AgentOutputSchema = z.object({
  notes: z.string(),
  result: z.string(),
});

export interface AgentOutput {
  notes: string;
  result: string;
}

/** One agent = one LLM call over the spec, the user prompt, and the full blackboard. */
export async function runAgent(
  llm: Llm,
  spec: AgentSpec,
  userPrompt: string,
  board: Blackboard,
  improvementNotes?: string
): Promise<AgentOutput> {
  return llm({
    system: [
      `You are "${spec.name}", a specialized text-only agent.`,
      `Your subtask: ${spec.instructions}`,
      `Hard constraints (truths you serve): ${spec.servesTruths.join(", ")}`,
      `Produce:`,
      `- result: your deliverable. Expected shape: ${spec.outputHint}`,
      `- notes: reasoning, caveats, and nuance that downstream agents need. Do not repeat the result here.`,
    ].join("\n"),
    prompt: [
      `## User prompt`,
      userPrompt,
      ``,
      `## Blackboard (everything produced so far — read it all, build on it, do not contradict it silently)`,
      board.render(),
      ...(improvementNotes
        ? [``, `## Your previous attempt was judged insufficient — fix exactly this`, improvementNotes]
        : []),
    ].join("\n"),
    schema: AgentOutputSchema,
    schemaName: "agent_output",
  });
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test tests/runtime`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/runtime/blackboard.ts src/runtime/agent.ts tests/runtime
git commit -m "feat: runtime blackboard and generic data-driven agent"
```

---

### Task 10: Runtime — per-prompt planner (triage + escape hatch) and orchestrator

**Files:**
- Create: `src/runtime/planner.ts`
- Create: `src/runtime/orchestrator.ts`
- Test: `tests/runtime/planner.test.ts`
- Test: `tests/runtime/orchestrator.test.ts`

**Interfaces:**
- Consumes: `Llm`; `Ontology`, `AgentSpec`, `failures` from shared types; `topoLevels`; `refine`; `judge`; `Blackboard`, `runAgent`.
- Produces:
  - `plan(llm: Llm, ontology: Ontology, userPrompt: string): Promise<PlanResult>` where `PlanResult = { fits: boolean; reason: string; agents: AgentSpec[] }` — selected set is closed under dependencies in code; unknown ids dropped.
  - `runOntology(llm: Llm, ontology: Ontology, userPrompt: string): Promise<RunResult>` where `RunResult = { answer: string; planned: string[]; escaped: boolean; board: BlackboardEntry[] }`.

Design intent: the ontology is a *decomposition policy*, applied per prompt. Triage decides whether the frame fits this prompt at all (frame falsifiable at runtime); if not, a single direct call answers it (escape hatch). Each agent runs inside a small `refine` loop judged against the ontology's `outputRubric` — reflection that fires on *insufficient* output, with the critique fed into the retry.

- [ ] **Step 1: Write failing tests for plan**

```typescript
// tests/runtime/planner.test.ts
import { describe, it, expect } from "vitest";
import { plan } from "../../src/runtime/planner";
import { Ontology } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const ontology: Ontology = {
  objective: "obj",
  truths: [], assumptions: [], subtasks: [],
  agents: [
    { id: "agent-s1", name: "A", subtaskId: "s1", instructions: "", servesTruths: [], dependsOn: [], outputHint: "" },
    { id: "agent-s2", name: "B", subtaskId: "s2", instructions: "", servesTruths: [], dependsOn: ["agent-s1"], outputHint: "" },
    { id: "agent-s3", name: "C", subtaskId: "s3", instructions: "", servesTruths: [], dependsOn: [], outputHint: "" },
  ],
  outputRubric: [],
};

const fakeLlm = (response: unknown): Llm => (async () => response) as unknown as Llm;

describe("plan", () => {
  it("closes the selected set under dependencies", async () => {
    const llm = fakeLlm({ fits: true, reason: "matches", selectedAgentIds: ["agent-s2"] });
    const result = await plan(llm, ontology, "prompt");
    expect(result.fits).toBe(true);
    expect(result.agents.map((a) => a.id).sort()).toEqual(["agent-s1", "agent-s2"]);
  });

  it("drops unknown agent ids", async () => {
    const llm = fakeLlm({ fits: true, reason: "r", selectedAgentIds: ["agent-s3", "agent-ghost"] });
    const result = await plan(llm, ontology, "prompt");
    expect(result.agents.map((a) => a.id)).toEqual(["agent-s3"]);
  });

  it("reports a non-fitting frame", async () => {
    const llm = fakeLlm({ fits: false, reason: "prompt is off-domain", selectedAgentIds: [] });
    const result = await plan(llm, ontology, "prompt");
    expect(result.fits).toBe(false);
    expect(result.agents).toEqual([]);
  });
});
```

- [ ] **Step 2: Write failing tests for runOntology**

```typescript
// tests/runtime/orchestrator.test.ts
import { describe, it, expect } from "vitest";
import { runOntology } from "../../src/runtime/orchestrator";
import { Ontology } from "../../src/shared/types";
import { Llm, LlmRequest } from "../../src/llm/gateway";

const ontology: Ontology = {
  objective: "evaluate claims",
  truths: [{ id: "t1", type: "constraint", statement: "cite evidence", rationale: "" }],
  assumptions: [],
  subtasks: [
    { id: "s1", description: "analyze", servesTruths: ["t1"], dependsOn: [] },
    { id: "s2", description: "conclude", servesTruths: ["t1"], dependsOn: ["s1"] },
  ],
  agents: [
    { id: "agent-s1", name: "Analyzer", subtaskId: "s1", instructions: "analyze", servesTruths: ["t1"], dependsOn: [], outputHint: "analysis" },
    { id: "agent-s2", name: "Concluder", subtaskId: "s2", instructions: "conclude", servesTruths: ["t1"], dependsOn: ["agent-s1"], outputHint: "conclusion" },
  ],
  outputRubric: [{ id: "o-responsive", description: "addresses the prompt", source: "generic" }],
};

/** Scripted by schemaName: plan → agent_output×2 (+judge passes) → synthesis. */
const scriptedLlm = (log: string[]): Llm =>
  (async <T>(req: LlmRequest<T>) => {
    log.push(req.schemaName);
    switch (req.schemaName) {
      case "triage_plan":
        return { fits: true, reason: "on-domain", selectedAgentIds: ["agent-s1", "agent-s2"] };
      case "agent_output":
        return { notes: "n", result: "agent deliverable" };
      case "rubric_verdicts":
        return { verdicts: [{ criterionId: "o-responsive", pass: true, evidence: "directly answers the question" }] };
      case "synthesis":
        return { answer: "final synthesized answer" };
      default:
        throw new Error(`unexpected schema ${req.schemaName}`);
    }
  }) as unknown as Llm;

describe("runOntology", () => {
  it("plans, executes agents in dependency order, and synthesizes from the board", async () => {
    const log: string[] = [];
    const result = await runOntology(scriptedLlm(log), ontology, "is this claim credible?");
    expect(result.escaped).toBe(false);
    expect(result.answer).toBe("final synthesized answer");
    expect(result.planned).toEqual(["agent-s1", "agent-s2"]);
    expect(result.board).toHaveLength(2);
    expect(log[0]).toBe("triage_plan");
    expect(log[log.length - 1]).toBe("synthesis");
  });

  it("escapes to a direct answer when the frame does not fit", async () => {
    const llm = (async <T>(req: LlmRequest<T>) => {
      if (req.schemaName === "triage_plan")
        return { fits: false, reason: "off-domain", selectedAgentIds: [] };
      if (req.schemaName === "direct_answer") return { answer: "direct answer" };
      throw new Error(`unexpected schema ${req.schemaName}`);
    }) as unknown as Llm;
    const result = await runOntology(llm, ontology, "unrelated prompt");
    expect(result.escaped).toBe(true);
    expect(result.answer).toBe("direct answer");
    expect(result.board).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test tests/runtime/planner.test.ts tests/runtime/orchestrator.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement plan**

```typescript
// src/runtime/planner.ts
import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Ontology, AgentSpec } from "../shared/types";

const PlanSchema = z.object({
  fits: z.boolean(),
  reason: z.string(),
  selectedAgentIds: z.array(z.string()),
});

export interface PlanResult {
  fits: boolean;
  reason: string;
  agents: AgentSpec[];
}

/**
 * Per-prompt triage. The ontology is a decomposition policy, not a mandate:
 * this step decides whether the frame fits THIS prompt, and which agents are
 * actually needed. Dependency closure is computed in code.
 */
export async function plan(llm: Llm, ontology: Ontology, userPrompt: string): Promise<PlanResult> {
  const raw = await llm({
    system: [
      "You decide whether an incoming prompt fits a pre-built agent system, and if so which agents to run.",
      "fits=false when the prompt is outside the system's objective/domain — do not force it.",
      "Select only agents whose subtask contributes to answering THIS prompt.",
    ].join("\n"),
    prompt: [
      `## System objective`,
      ontology.objective,
      ``,
      `## Available agents`,
      ...ontology.agents.map((a) => `- ${a.id}: ${a.name} — ${a.instructions}`),
      ``,
      `## Incoming prompt`,
      userPrompt,
    ].join("\n"),
    schema: PlanSchema,
    schemaName: "triage_plan",
  });

  if (!raw.fits) return { fits: false, reason: raw.reason, agents: [] };

  const byId = new Map(ontology.agents.map((a) => [a.id, a]));
  const selected = new Set<string>();
  const queue = raw.selectedAgentIds.filter((id) => byId.has(id));
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (selected.has(id)) continue;
    selected.add(id);
    queue.push(...byId.get(id)!.dependsOn.filter((d) => byId.has(d)));
  }

  return {
    fits: true,
    reason: raw.reason,
    agents: ontology.agents.filter((a) => selected.has(a.id)), // preserve ontology order
  };
}
```

- [ ] **Step 5: Implement runOntology**

```typescript
// src/runtime/orchestrator.ts
import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Ontology } from "../shared/types";
import { topoLevels } from "../shared/graph";
import { refine } from "../shared/refine";
import { judge } from "../shared/judge";
import { Blackboard, BlackboardEntry } from "./blackboard";
import { runAgent, AgentOutput } from "./agent";
import { plan } from "./planner";

const AnswerSchema = z.object({ answer: z.string() });

export interface RunResult {
  answer: string;
  planned: string[];
  escaped: boolean;
  board: BlackboardEntry[];
}

export async function runOntology(llm: Llm, ontology: Ontology, userPrompt: string): Promise<RunResult> {
  const triage = await plan(llm, ontology, userPrompt);

  if (!triage.fits) {
    // Escape hatch: never force a prompt through a frame that does not fit.
    const direct = await llm({
      system: `Answer the user's prompt directly and thoroughly. Context: this system was built for the objective "${ontology.objective}" but the prompt falls outside it (${triage.reason}).`,
      prompt: userPrompt,
      schema: AnswerSchema,
      schemaName: "direct_answer",
    });
    return { answer: direct.answer, planned: [], escaped: true, board: [] };
  }

  const board = new Blackboard();
  const levels = topoLevels(triage.agents.map((a) => ({ id: a.id, dependsOn: a.dependsOn })));
  if (!levels) throw new Error("Circular dependency among planned agents.");
  const specById = new Map(triage.agents.map((a) => [a.id, a]));

  for (const level of levels) {
    const outputs = await Promise.all(
      level.map(async (agentId) => {
        const spec = specById.get(agentId)!;
        const outcome = await refine<AgentOutput>(
          (feedback) =>
            runAgent(
              llm, spec, userPrompt, board,
              feedback
                ? feedback.critique.verdicts.filter((v) => !v.pass).map((v) => `${v.criterionId}: ${v.evidence}`).join("\n")
                : undefined
            ),
          (candidate) =>
            judge(llm, {
              rubric: ontology.outputRubric,
              candidate: `Result:\n${candidate.result}\n\nNotes:\n${candidate.notes}`,
              context: `Agent "${spec.name}" (${spec.instructions}) answering: ${userPrompt}`,
            }),
          { maxIterations: 3 }
        );
        return { spec, output: outcome.result };
      })
    );
    // Write after the level completes so same-level agents don't race on reads.
    for (const { spec, output } of outputs) {
      board.add({ agentId: spec.id, subtask: spec.instructions, notes: output.notes, result: output.result });
    }
  }

  const synthesis = await llm({
    system: [
      "You synthesize the final answer from the work on the blackboard.",
      "Use everything: results AND notes. Preserve nuance; surface disagreements between agents instead of papering over them.",
    ].join("\n"),
    prompt: [
      `## User prompt`,
      userPrompt,
      ``,
      `## Blackboard`,
      board.render(),
    ].join("\n"),
    schema: z.object({ answer: z.string() }),
    schemaName: "synthesis",
  });

  return {
    answer: synthesis.answer,
    planned: triage.agents.map((a) => a.id),
    escaped: false,
    board: board.all(),
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test tests/runtime`
Expected: PASS (planner 3, orchestrator 2, plus Task 9's 4).

- [ ] **Step 7: Commit**

```bash
git add src/runtime/planner.ts src/runtime/orchestrator.ts tests/runtime
git commit -m "feat: per-prompt triage planner with escape hatch and level-parallel orchestrator"
```

---

### Task 11: Emit (data-driven packages) and CLI rewire

**Files:**
- Create: `src/core/emit.ts`
- Create: `src/runtime/main.ts`
- Modify: `src/scripts/agentGenerator.ts` (full rewrite, shown below)
- Test: `tests/core/emit.test.ts`

**Interfaces:**
- Consumes: `Ontology` from shared types; `GenerationReport`, `generateOntology` from `src/core/pipeline`; `makeOpenAiLlm` from `src/llm/gateway`; `runOntology` from `src/runtime/orchestrator`.
- Produces: `emitPackage(baseDir: string, report: GenerationReport, packagesRoot: string, packageName: string): string` (returns the package dir). The emitted package contains: `package.json`, `tsconfig.json`, `src/ontology.json`, copies of `src/shared/`, `src/llm/`, `src/runtime/`, and a mechanically rendered `Overview.md` (no LLM call — rendered from ontology data, so it cannot hallucinate).

- [ ] **Step 1: Write failing tests for emitPackage**

```typescript
// tests/core/emit.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { emitPackage } from "../../src/core/emit";
import { GenerationReport } from "../../src/core/pipeline";

const report: GenerationReport = {
  ontology: {
    objective: "evaluate study credibility",
    truths: [{ id: "t1", type: "constraint", statement: "cite evidence", rationale: "r" }],
    assumptions: [{ id: "t2", type: "assumption", statement: "user reads English", rationale: "r" }],
    subtasks: [{ id: "s1", description: "analyze", servesTruths: ["t1"], dependsOn: [] }],
    agents: [{ id: "agent-s1", name: "Analyzer", subtaskId: "s1", instructions: "analyze", servesTruths: ["t1"], dependsOn: [], outputHint: "analysis" }],
    outputRubric: [{ id: "o-responsive", description: "addresses prompt", source: "generic" }],
  },
  vet: { kept: [], assumptions: [], rejected: [] },
  decomposition: { status: "converged", result: [], iterations: 1, history: [] },
};

describe("emitPackage", () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "emit-test-")); });
  afterEach(() => { fs.removeSync(tmp); });

  it("writes ontology.json, runtime sources, package.json, and Overview.md", () => {
    const baseDir = path.join(__dirname, "..", ".."); // repo root
    const pkgDir = emitPackage(baseDir, report, tmp, "test-package");

    const ontology = fs.readJsonSync(path.join(pkgDir, "src", "ontology.json"));
    expect(ontology.objective).toBe("evaluate study credibility");

    expect(fs.existsSync(path.join(pkgDir, "src", "runtime", "orchestrator.ts"))).toBe(true);
    expect(fs.existsSync(path.join(pkgDir, "src", "shared", "types.ts"))).toBe(true);
    expect(fs.existsSync(path.join(pkgDir, "src", "llm", "gateway.ts"))).toBe(true);

    const pkgJson = fs.readJsonSync(path.join(pkgDir, "package.json"));
    expect(pkgJson.scripts["run-agents"]).toBeDefined();
    expect(pkgJson.dependencies.zod).toBeDefined();

    const overview = fs.readFileSync(path.join(pkgDir, "Overview.md"), "utf8");
    expect(overview).toContain("cite evidence");           // truths rendered
    expect(overview).toContain("Proceeding as if");        // assumptions surfaced
    expect(overview).toContain("agent-s1");                // agents listed
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test tests/core/emit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement emitPackage**

```typescript
// src/core/emit.ts
import fs from "fs-extra";
import path from "path";
import { Ontology } from "../shared/types";
import { GenerationReport } from "./pipeline";

/**
 * Emit a self-contained, DATA-driven package: ontology.json + copied runtime.
 * No code generation, no LLM text interpolated into source files, and the
 * Overview is rendered mechanically from the ontology so it cannot lie.
 */
export function emitPackage(
  baseDir: string,
  report: GenerationReport,
  packagesRoot: string,
  packageName: string
): string {
  const { ontology } = report;
  const pkgDir = path.join(packagesRoot, packageName);
  const srcDir = path.join(pkgDir, "src");
  fs.ensureDirSync(srcDir);

  fs.writeJsonSync(path.join(srcDir, "ontology.json"), ontology, { spaces: 2 });

  for (const dir of ["shared", "llm", "runtime"]) {
    fs.copySync(path.join(baseDir, "src", dir), path.join(srcDir, dir));
  }
  fs.copyFileSync(path.join(baseDir, "tsconfig.json"), path.join(pkgDir, "tsconfig.json"));

  fs.writeJsonSync(
    path.join(pkgDir, "package.json"),
    {
      name: packageName,
      version: "1.0.0",
      license: "MIT",
      dependencies: { openai: "^4.70.2", zod: "^3.23.0", dotenv: "^16.4.5" },
      scripts: {
        build: "tsc",
        "run-agents": "tsc && node dist/runtime/main.js",
      },
    },
    { spaces: 2 }
  );

  fs.writeFileSync(path.join(pkgDir, "Overview.md"), renderOverview(ontology, report), "utf8");
  return pkgDir;
}

function renderOverview(ontology: Ontology, report: GenerationReport): string {
  const lines: string[] = [
    `# ${ontology.objective}`,
    ``,
    `Generated agent system. Run with: \`npm run run-agents "<your prompt>"\``,
    ``,
    `## Fundamental truths (vetted)`,
    ...ontology.truths.map((t) => `- **${t.id}** [${t.type}]: ${t.statement}`),
    ``,
    `## Assumptions — Proceeding as if these hold. Correct us if not:`,
    ...(ontology.assumptions.length
      ? ontology.assumptions.map((t) => `- **${t.id}**: ${t.statement}`)
      : ["- (none)"]),
    ``,
    `## Agents`,
    ...ontology.agents.map(
      (a) =>
        `- **${a.id}** (${a.name}): ${a.instructions}\n  - serves: ${a.servesTruths.join(", ")}` +
        (a.dependsOn.length ? `\n  - depends on: ${a.dependsOn.join(", ")}` : "")
    ),
    ``,
    `## Output rubric (every run is judged against this)`,
    ...ontology.outputRubric.map((c) => `- ${c.id}: ${c.description}`),
    ``,
    `## Generation report`,
    `- Decomposition: ${report.decomposition.status} after ${report.decomposition.iterations} iteration(s).`,
    ...(report.vet.rejected.length
      ? [`- Rejected truths:`, ...report.vet.rejected.map((r) => `  - "${r.truth.statement}" — ${r.attack}`)]
      : []),
  ];
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Implement the generated package's entry point**

```typescript
// src/runtime/main.ts
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import { makeOpenAiLlm } from "../llm/gateway";
import { Ontology } from "../shared/types";
import { runOntology } from "./orchestrator";

dotenv.config();

async function main() {
  const prompt = process.argv.slice(2).join(" ");
  if (!prompt) {
    console.error('Usage: npm run run-agents "<your prompt>"');
    process.exit(1);
  }
  const token = process.env.OPEN_AI_TOKEN;
  if (!token) {
    console.error("OPEN_AI_TOKEN is not set.");
    process.exit(1);
  }

  const ontologyPath = path.join(__dirname, "..", "ontology.json");
  const ontology: Ontology = JSON.parse(fs.readFileSync(ontologyPath, "utf8"));
  const llm = makeOpenAiLlm(new OpenAI({ apiKey: token }));

  const result = await runOntology(llm, ontology, prompt);
  if (result.escaped) {
    console.log("[note] Prompt fell outside this system's frame; answered directly.\n");
  } else {
    console.log(`[agents run: ${result.planned.join(", ")}]\n`);
  }
  console.log(result.answer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Note: `ontology.json` sits at `src/ontology.json`; after `tsc` the compiled `dist/runtime/main.js` resolves `__dirname/../ontology.json` → `dist/ontology.json`. Add a copy step so it lands there — in the emitted `package.json`, make build: `"build": "tsc && cp src/ontology.json dist/ontology.json"` and `"run-agents": "npm run build && node dist/runtime/main.js"`. Update `emit.ts` accordingly (adjust the Step 3 code and the Step 1 test expectation string if you assert on it).

- [ ] **Step 5: Rewrite the CLI**

```typescript
// src/scripts/agentGenerator.ts
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";
import { makeOpenAiLlm } from "../llm/gateway";
import { generateOntology } from "../core/pipeline";
import { emitPackage } from "../core/emit";

const main = async () => {
  const userPrompt = process.argv.slice(2).join(" ");
  if (!userPrompt) {
    console.error('Usage: yarn generate-agents "<goal or problem statement>"');
    process.exit(1);
  }
  const token = process.env.OPEN_AI_TOKEN;
  if (!token) {
    console.error("OPEN_AI_TOKEN is not set.");
    process.exit(1);
  }

  const llm = makeOpenAiLlm(new OpenAI({ apiKey: token }));
  console.log("Deriving and vetting truths, decomposing, generating agent specs...");
  const report = await generateOntology(llm, userPrompt);

  // Surface what the mechanisms found — this is the point of building them.
  if (report.vet.assumptions.length > 0) {
    console.log("\nProceeding on these ASSUMPTIONS (correct me if wrong):");
    for (const a of report.vet.assumptions) console.log(`  - ${a.statement}`);
  }
  if (report.vet.rejected.length > 0) {
    console.log("\nRejected candidate truths:");
    for (const r of report.vet.rejected) console.log(`  - "${r.truth.statement}" — ${r.attack}`);
  }
  console.log(`\nDecomposition: ${report.decomposition.status} after ${report.decomposition.iterations} iteration(s).`);
  if (report.decomposition.status === "escalated") {
    console.log(`  Stuck on criteria: ${report.decomposition.stuckOn.join(", ")} — review the ontology before trusting it.`);
  }

  const baseDir = path.join(__dirname, "..", "..");
  const packageName = `agent-package-${Date.now()}`;
  const pkgDir = emitPackage(baseDir, report, path.join(baseDir, "packages"), packageName);
  console.log(`\nPackage created: ${pkgDir}`);
  console.log(`Run it with:\n  cd packages/${packageName} && npm install && npm run run-agents "<prompt>"`);
};

main().catch((err) => {
  console.error("Generation failed:", err.message);
  process.exit(1);
});
```

- [ ] **Step 6: Run the emit test and full suite**

Run: `yarn test`
Expected: PASS — all tests including `tests/core/emit.test.ts`.

- [ ] **Step 7: Verify the main build**

Run: `yarn build`
Expected: compiles cleanly (old dirs still present; they are deleted next task).

- [ ] **Step 8: Commit**

```bash
git add src/core/emit.ts src/runtime/main.ts src/scripts/agentGenerator.ts tests/core/emit.test.ts
git commit -m "feat: data-driven package emission and rewired CLI"
```

---

### Task 12: Delete the old world, update README

**Files:**
- Delete: `src/prompt-decomposition-agents/`, `src/agent-planner-agents/`, `src/agent-planner-config/`, `src/user-agent-objective-agents/`, `src/user-agent-objective-config/`, `src/templates/`, `src/services/`, `src/scaffold/`, `src/llms/`, `src/utils/`, `src/types/`, `src/testOrchestrator.js`
- Modify: `README.md`, `package.json`

**Interfaces:**
- Consumes: nothing new. This task only removes code and updates docs.
- Produces: a repo where `src/` contains exactly `shared/`, `llm/`, `core/`, `runtime/`, `scripts/`.

Rationale recap for the executor: the three old pipelines were near-duplicate generations of each other (one was entirely dead — `getAgentPlan` was never called); the templates were LLM-text-interpolated codegen with a latent const-reassignment bug; `utils/responseUtils`/`stringUtils` existed only to clean unstructured JSON and escape backticks, both needs eliminated by structured outputs and data-driven emission. The old `getUserObjective` pre-processing pipeline is intentionally not replaced: `deriveTruths` reads the raw prompt directly.

- [ ] **Step 1: Delete the dead directories**

```bash
git rm -r src/prompt-decomposition-agents src/agent-planner-agents src/agent-planner-config \
  src/user-agent-objective-agents src/user-agent-objective-config src/templates \
  src/services src/scaffold src/llms src/utils src/types src/testOrchestrator.js
```

- [ ] **Step 2: Remove now-unused dependencies**

Run: `yarn remove axios jsonrepair`
(`axios` served only the deleted `apiTool`; `jsonrepair` served only the deleted `responseUtils`.)

- [ ] **Step 3: Verify build and tests still pass**

Run: `yarn build && yarn test`
Expected: both PASS. If the build fails, a new-world file still imports something deleted — fix the import, do not resurrect the old file.

- [ ] **Step 4: Update README.md**

Replace the "Architecture Overview", "How It Works", and "Recent Enhancements" sections with a description of the new pipeline (keep Influences, License, Contributing). Key content to include verbatim in the new "How It Works":

```markdown
## How It Works

1. **Typed truths**: The goal is decomposed into typed, falsifiable claims — facts,
   assumptions, constraints, definitions. Types are commitments the system checks.
2. **Adversarial vetting**: A skeptic pass attacks every truth. Survivors are kept,
   unverifiable ones are demoted to explicit assumptions (surfaced to you), broken
   ones are rejected with the attack recorded.
3. **Decomposition with citations**: Every subtask must cite the truths it serves.
   Coverage is computed in code: an uncited truth is a missed requirement; a
   subtask citing nothing is scope creep.
4. **Refinement, not re-rolls**: The decomposition is revised against the judge's
   evidence-backed critique until nothing new fails (fixed point), the same
   criterion fails twice (escalate — looping again would be a re-roll), or the
   iteration budget runs out.
5. **Data, not codegen**: The output package is an `ontology.json` plus a generic
   runtime. At run time, a triage step checks whether your prompt fits the frame
   (and answers directly if it doesn't), plans which agents to run, executes them
   in dependency levels over a shared blackboard, judges every output against a
   rubric derived from the truths, and synthesizes the final answer.
```

Also update: Prerequisites → Node 18+; remove the o1-models troubleshooting section; remove the "Circular Dependencies" troubleshooting section (cycles are now caught mechanically at generation time).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove legacy pipelines, codegen templates, and JSON-repair utils; update README"
```

---

### Task 13: Live end-to-end smoke test (requires OPEN_AI_TOKEN)

**Files:**
- None created (manual verification; findings go in the PR/commit description).

**Interfaces:**
- Consumes: the full system.
- Produces: confidence.

- [ ] **Step 1: Generate a package with the canonical rubric-shaped example**

Run: `yarn generate-agents "I want to evaluate whether a claim backed by data is based on a sufficiently rigorous study worthy of being considered true"`
Expected: console shows typed truths surviving vetting, any assumptions listed, "Decomposition: converged after N iteration(s)", and a `packages/agent-package-*/` directory containing `src/ontology.json` and `Overview.md`.

- [ ] **Step 2: Inspect the ontology**

Open `packages/agent-package-*/src/ontology.json`. Verify by eye: truths are typed and falsifiable (not restatements of the goal); every subtask's `servesTruths` is non-empty; the `outputRubric` contains one `o-t*` criterion per constraint truth.

- [ ] **Step 3: Run the generated package on an in-frame prompt**

```bash
cd packages/agent-package-*/ && npm install && npm run run-agents "A press release claims a supplement reduces anxiety by 40% based on a study of 12 people with no control group. Should I believe it?"
```
Expected: `[agents run: ...]` lists the planned agents; the answer addresses the specific claim with evidence-based reasoning.

- [ ] **Step 4: Run the generated package on an out-of-frame prompt (escape hatch)**

Run: `npm run run-agents "Write me a haiku about autumn"`
Expected: `[note] Prompt fell outside this system's frame; answered directly.` followed by a direct answer — the frame refused to force the prompt through itself.

- [ ] **Step 5: Commit any fixes found, then finish**

```bash
git add -A
git commit -m "fix: adjustments from live end-to-end smoke test"
```
(Skip the commit if nothing needed fixing.)

---

## Self-Review Notes

- **Spec coverage:** typed truths (T6), adversarial vetting (T6), computable coverage (T2), critique-fed refinement with fixed-point/escalation (T3, wired in T8), evidence-required default-insufficient judge (T5), truths-as-rubric (T7), ontology-compile + per-prompt planning + escape hatch (T8, T10), blackboard full-fidelity content (T9), no codegen / data-driven packages (T11), dead-code removal + honest mechanical Overview (T11, T12). All six conceptual fixes have implementing tasks.
- **Type consistency:** `Llm`/`LlmRequest` (T4) consumed by T5–T11; `Critique{verdicts}`+`failures()` (T1) used by T2, T3, T5, T7, T8, T10; `RefineFeedback`/`RefineOutcome` (T3) used by T7, T8, T10; `Ontology` fields (T1) match what T8 builds, T10 consumes, T11 serializes; schemaName strings (`typed_truths`, `truth_attack`, `decomposition`, `rubric_verdicts`, `agent_spec`, `triage_plan`, `agent_output`, `synthesis`, `direct_answer`) are consistent between implementations and the scripted-fake tests in T8/T10.
- **Known judgment calls:** `refine` escalation is consecutive-failure-based (two in a row), not global-history-based — deliberate, so a criterion that fails, passes, then fails again still gets another chance. Runtime agent reflection uses `maxIterations: 3` (cost control) vs generation's 5. Escalated/exhausted decompositions still emit a package but are loudly reported — the user decides, the system doesn't silently bless.
