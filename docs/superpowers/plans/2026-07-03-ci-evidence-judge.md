# ci-evidence-judge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `yarn judge-diff` grades a PR diff criterion-by-criterion against the repo's compiled review rubric and posts an advisory verdict-table comment from CI, per the approved spec `docs/superpowers/specs/2026-07-03-ci-evidence-judge-design.md`.

**Architecture:** Pure/injectable logic in `src/core/diffJudge.ts` (candidate building with a loud size cap, rubric loading, judging via the existing `judge()`, markdown verdict table), a thin argv-parsing CLI in `src/scripts/judgeDiff.ts` with an exported `run(argv, deps)` for tests, a `pull_request` workflow that upserts one marker-keyed comment and degrades gracefully without the secret. Two deferred minors from build 1 are fixed first because this build consumes them.

**Tech Stack:** Existing repo stack — TypeScript (CommonJS, strict), zod 3, `Llm` gateway, vitest, `gh` CLI in the workflow.

## Global Constraints

- All model calls via the injected `Llm`; the diff judge reuses `src/shared/judge.ts`'s `judge()` unchanged; no new schemaNames.
- New files live in `src/core/` and `src/scripts/` only — nothing under `src/shared|llm|runtime` changes in Tasks 2–4 (Task 1 touches `src/core/rubricCompiler.ts` and `src/scripts/rubricCli.ts` only).
- Exit codes: 0 = success/advisory (including `--comment` without PR context, empty diff, missing secret path in CI); 1 = `--strict` with ≥1 failed criterion; 2 = infrastructure errors (missing/invalid rubric, git failure, LLM failure).
- `DIFF_CHAR_CAP = 120_000`; truncation happens on a line boundary and is announced in the candidate AND the rendered table.
- PR comment is keyed by the hidden marker `<!-- principles-evidence-judge -->` and upserted (never a second comment).
- Rubric default path `.github/review-rubric.json`; range default `origin/main...HEAD`.
- Work on branch `ci-evidence-judge` (created from merged main `794b5f6`). `yarn build && yarn test` green at every commit.

---

### Task 1: Build-1 deferred minors — status union and stuckOn surfacing

**Files:**
- Modify: `src/core/rubricCompiler.ts`
- Modify: `src/scripts/rubricCli.ts`
- Test: `tests/core/rubricCompiler.test.ts` (append/adjust)

**Interfaces:**
- Consumes: `RefineOutcome` from `src/shared/refine.ts` (its `status` values are `"converged" | "escalated" | "exhausted"`; `stuckOn: string[]` exists only on the escalated variant).
- Produces (later tasks and the CLI rely on):

```typescript
export type LoopStatus = "converged" | "escalated" | "exhausted";
// CompiledRubric.decomposition/gradeability become:
//   { status: LoopStatus; iterations: number }
// gradeabilityCheck returns:
//   Promise<{ criteria: CompiledCriterion[]; status: LoopStatus; iterations: number; stuckOn?: string[] }>
// CompiledRubric.gradeability gains OPTIONAL stuckOn?: string[]
```

- [ ] **Step 1: Write the failing test (append to the gradeabilityCheck describe block)**

```typescript
  it("surfaces stuckOn meta-criteria on escalation", async () => {
    const llm = (async (req: any) => {
      if (req.schemaName === "rubric_verdicts") return failIndependent;
      if (req.schemaName === "rubric_revision")
        return { criteria: [{ id: "c-invented", description: "new!", evidenceGuidance: "x" }] };
      throw new Error(`unexpected ${req.schemaName}`);
    }) as unknown as Llm;
    const out = await gradeabilityCheck(llm, "obj", guided());
    expect(out.status).toBe("escalated");
    expect(out.stuckOn).toEqual(["m-independent"]);
  });
```

And in the existing `compileRubric` test add:

```typescript
    expect(rubric.gradeability.stuckOn).toBeUndefined(); // converged → no stuckOn
```

- [ ] **Step 2: Run to verify RED**

Run: `node_modules/.bin/vitest run tests/core/rubricCompiler.test.ts`
Expected: FAIL — `stuckOn` undefined vs `["m-independent"]` (TS may also complain the property doesn't exist; that's the same RED).

- [ ] **Step 3: Implement**

In `src/core/rubricCompiler.ts`:

1. Add near the top (after imports): `export type LoopStatus = "converged" | "escalated" | "exhausted";`
2. In `CompiledRubric`, change both loop fields to use the union, and add optional stuckOn:

```typescript
  /** Decomposition outcome from foundations — reported, never silently blessed. */
  decomposition: { status: LoopStatus; iterations: number };
  gradeability: { status: LoopStatus; iterations: number; stuckOn?: string[] };
```

3. Change `gradeabilityCheck`'s return type to `Promise<{ criteria: CompiledCriterion[]; status: LoopStatus; iterations: number; stuckOn?: string[] }>` and its return statement to:

```typescript
  return {
    criteria: outcome.result,
    status: outcome.status,
    iterations: outcome.iterations,
    ...(outcome.status === "escalated" ? { stuckOn: outcome.stuckOn } : {}),
  };
```

4. In `compileRubric`'s assembly, replace the gradeability line with:

```typescript
    gradeability: {
      status: checked.status,
      iterations: checked.iterations,
      ...(checked.stuckOn ? { stuckOn: checked.stuckOn } : {}),
    },
```

(`f.decomposition.status` already flows the union type once the interface says so — no cast needed.)

In `src/scripts/rubricCli.ts`, inside the existing `if (rubric.gradeability.status !== "converged")` block, add after the existing caution line:

```typescript
    if (rubric.gradeability.stuckOn?.length) {
      console.log(`  Stuck on meta-criteria: ${rubric.gradeability.stuckOn.join(", ")}`);
    }
```

- [ ] **Step 4: Run tests, build, full suite**

Run: `yarn build && yarn test`
Expected: green (72 existing + 1 new assertion set = 73 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/rubricCompiler.ts src/scripts/rubricCli.ts tests/core/rubricCompiler.test.ts
git commit -m "fix: LoopStatus union and stuckOn surfacing from build-1 review deferrals"
```

---

### Task 2: diffJudge core — candidate, rubric loading, judging, verdict table

**Files:**
- Create: `src/core/diffJudge.ts`
- Test: `tests/core/diffJudge.test.ts`

**Interfaces:**
- Consumes: `Llm` (`../llm/gateway`); `judge` (`../shared/judge`); `Critique`, `Criterion`, `failures` (`../shared/types`); `CompiledRubric` (`./rubricCompiler`).
- Produces (Task 3 relies on these exact names):

```typescript
export const DIFF_CHAR_CAP = 120_000;
export const COMMENT_MARKER = "<!-- principles-evidence-judge -->";
export interface DiffJudgment {
  critique: Critique;
  truncated: boolean;
  rubricObjective: string;
  criteriaCount: number;
}
export function buildCandidate(diff: string): { candidate: string; truncated: boolean };
export function loadRubricCriteria(rubricJson: unknown): CompiledRubric;   // throws Error naming what's malformed
export async function judgeDiff(llm: Llm, diff: string, rubric: CompiledRubric): Promise<DiffJudgment>;
export function renderVerdictTable(j: DiffJudgment): string;
```

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/core/diffJudge.test.ts
import { describe, it, expect } from "vitest";
import {
  buildCandidate, loadRubricCriteria, judgeDiff, renderVerdictTable,
  DIFF_CHAR_CAP, COMMENT_MARKER, DiffJudgment,
} from "../../src/core/diffJudge";
import { CompiledRubric } from "../../src/core/rubricCompiler";
import { Llm, LlmRequest } from "../../src/llm/gateway";

const rubric: CompiledRubric = {
  objective: "review a code change",
  criteria: [
    { id: "c-t1", source: "truth", truthId: "t1", description: "No new SDK imports outside the gateway.", evidenceGuidance: "Check import lines." },
    { id: "c-s1", source: "subtask", subtaskId: "s1", description: "Behavior changes carry test changes.", evidenceGuidance: "Look for test files in the diff." },
  ],
  truths: [], assumptions: [], rejectedTruths: [],
  decomposition: { status: "converged", iterations: 1 },
  gradeability: { status: "converged", iterations: 1 },
  generatedAt: "2026-07-03T00:00:00.000Z", model: "claude-opus-4-8",
};

describe("buildCandidate", () => {
  it("passes small diffs through with framing, untruncated", () => {
    const { candidate, truncated } = buildCandidate("diff --git a/x b/x\n+added line");
    expect(truncated).toBe(false);
    expect(candidate).toContain("Unified git diff under review:");
    expect(candidate).toContain("+added line");
  });

  it("truncates huge diffs on a line boundary with a loud notice", () => {
    const line = "+" + "x".repeat(99) + "\n"; // 101 chars per line
    const huge = "diff --git a/big b/big\n" + line.repeat(2000); // > cap
    const { candidate, truncated } = buildCandidate(huge);
    expect(truncated).toBe(true);
    expect(candidate.length).toBeLessThanOrEqual(DIFF_CHAR_CAP + 200); // cap + framing + notice
    expect(candidate).toContain("[diff truncated at");
    expect(candidate.split("\n").every((l) => l.length <= 120)).toBe(true); // no mid-line cut
  });
});

describe("loadRubricCriteria", () => {
  it("returns the rubric when shaped correctly", () => {
    expect(loadRubricCriteria(JSON.parse(JSON.stringify(rubric))).criteria).toHaveLength(2);
  });
  it("throws a descriptive error on malformed input", () => {
    expect(() => loadRubricCriteria({ nope: true })).toThrow(/rubric|criteria/i);
    expect(() => loadRubricCriteria({ objective: "x", criteria: "not-an-array" })).toThrow(/criteria/i);
  });
});

describe("judgeDiff", () => {
  it("judges the framed candidate against rubric.criteria with a diff-citing context", async () => {
    const capture: { req?: LlmRequest<unknown> } = {};
    const llm = (async (req: LlmRequest<unknown>) => {
      capture.req = req;
      return {
        verdicts: [
          { criterionId: "c-t1", pass: true, evidence: "no import lines added anywhere in the diff" },
          { criterionId: "c-s1", pass: false, evidence: "src/x.ts changed but no test file appears" },
        ],
      };
    }) as unknown as Llm;
    const j = await judgeDiff(llm, "diff --git a/x b/x\n+line", rubric);
    expect(capture.req!.schemaName).toBe("rubric_verdicts");
    expect(capture.req!.prompt).toContain("c-t1");
    expect(capture.req!.prompt).toContain("Unified git diff under review:");
    expect(j.critique.verdicts).toHaveLength(2);
    expect(j.truncated).toBe(false);
    expect(j.rubricObjective).toBe("review a code change");
    expect(j.criteriaCount).toBe(2);
  });
});

describe("renderVerdictTable", () => {
  const judgment: DiffJudgment = {
    critique: {
      verdicts: [
        { criterionId: "c-t1", pass: true, evidence: "clean | imports" },
        { criterionId: "c-s1", pass: false, evidence: "no tests touched" },
      ],
    },
    truncated: true,
    rubricObjective: "review a code change",
    criteriaCount: 2,
  };
  it("renders marker, advisory note, escaped rows, truncation notice, and pass/fail icons", () => {
    const md = renderVerdictTable(judgment);
    expect(md).toContain(COMMENT_MARKER);
    expect(md.toLowerCase()).toContain("advisory");
    expect(md).toContain("✅");
    expect(md).toContain("❌");
    expect(md).toContain("clean \\| imports"); // pipe escaped
    expect(md.toLowerCase()).toContain("truncated");
    expect(md).toContain("review a code change");
  });
  it("omits the truncation notice when not truncated", () => {
    const md = renderVerdictTable({ ...judgment, truncated: false });
    expect(md.toLowerCase()).not.toContain("truncated");
  });
});
```

- [ ] **Step 2: Run to verify RED** — `node_modules/.bin/vitest run tests/core/diffJudge.test.ts` → module not found.

- [ ] **Step 3: Implement**

```typescript
// src/core/diffJudge.ts
import { Llm } from "../llm/gateway";
import { judge } from "../shared/judge";
import { Critique } from "../shared/types";
import { CompiledRubric } from "./rubricCompiler";

export const DIFF_CHAR_CAP = 120_000;
export const COMMENT_MARKER = "<!-- principles-evidence-judge -->";

export interface DiffJudgment {
  critique: Critique;
  truncated: boolean;
  rubricObjective: string;
  criteriaCount: number;
}

/** Frame the diff; truncate huge ones on a line boundary — loudly, never silently. */
export function buildCandidate(diff: string): { candidate: string; truncated: boolean } {
  const framing = "Unified git diff under review:\n\n";
  if (diff.length <= DIFF_CHAR_CAP) {
    return { candidate: framing + diff, truncated: false };
  }
  const cut = diff.lastIndexOf("\n", DIFF_CHAR_CAP);
  const kept = diff.slice(0, cut > 0 ? cut : DIFF_CHAR_CAP);
  return {
    candidate: `${framing}${kept}\n[diff truncated at ${kept.length} chars of ${diff.length}]`,
    truncated: true,
  };
}

/** Minimal shape validation with descriptive failures — no zod needed for a local file. */
export function loadRubricCriteria(rubricJson: unknown): CompiledRubric {
  const r = rubricJson as CompiledRubric;
  if (!r || typeof r !== "object" || typeof r.objective !== "string") {
    throw new Error("Invalid rubric file: expected a CompiledRubric with an 'objective' string. Regenerate with: yarn compile-rubric");
  }
  if (!Array.isArray(r.criteria) || r.criteria.length === 0) {
    throw new Error("Invalid rubric file: 'criteria' must be a non-empty array. Regenerate with: yarn compile-rubric");
  }
  for (const c of r.criteria) {
    if (typeof c.id !== "string" || typeof c.description !== "string") {
      throw new Error("Invalid rubric file: every criterion needs string 'id' and 'description'. Regenerate with: yarn compile-rubric");
    }
  }
  return r;
}

export async function judgeDiff(llm: Llm, diff: string, rubric: CompiledRubric): Promise<DiffJudgment> {
  const { candidate, truncated } = buildCandidate(diff);
  const critique = await judge(llm, {
    rubric: rubric.criteria,
    candidate,
    context: [
      `You are reviewing a code change to the Principles framework repository.`,
      `Rubric objective: ${rubric.objective}`,
      `Evidence MUST cite concrete file paths and hunks from the diff itself.`,
    ].join("\n"),
  });
  return { critique, truncated, rubricObjective: rubric.objective, criteriaCount: rubric.criteria.length };
}

const escapeCell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/** Pure markdown rendering — marker first so CI can upsert the comment. */
export function renderVerdictTable(j: DiffJudgment): string {
  const lines = [
    COMMENT_MARKER,
    `### Evidence judge (advisory)`,
    ``,
    `Graded against: *${j.rubricObjective}* (${j.criteriaCount} criteria). This comment never blocks merge.`,
    ``,
    ...(j.truncated ? [`> ⚠️ The diff exceeded ${DIFF_CHAR_CAP} chars and was truncated before judging.`, ``] : []),
    `| criterion | verdict | evidence |`,
    `|---|---|---|`,
    ...j.critique.verdicts.map(
      (v) => `| \`${v.criterionId}\` | ${v.pass ? "✅ PASS" : "❌ FAIL"} | ${escapeCell(v.evidence)} |`
    ),
  ];
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run tests, build, full suite** — green.

- [ ] **Step 5: Commit**

```bash
git add src/core/diffJudge.ts tests/core/diffJudge.test.ts
git commit -m "feat: diff judging core — capped candidate, rubric loading, verdict table"
```

---

### Task 3: judge-diff CLI with injectable deps

**Files:**
- Create: `src/scripts/judgeDiff.ts`
- Modify: `package.json` (script)
- Test: `tests/scripts/judgeDiff.test.ts`

**Interfaces:**
- Consumes: everything from Task 2; `makeClaudeAgentSdkLlm` (`../llm/claudeGateway`); `failures` (`../shared/types`).
- Produces:

```typescript
export interface JudgeDiffDeps {
  llm: Llm;
  exec: (cmd: string) => string;            // execSync wrapper returning stdout (throws on nonzero)
  readFile: (p: string) => string;
  log: (s: string) => void;
  error: (s: string) => void;
}
export async function run(argv: string[], deps: JudgeDiffDeps): Promise<number>  // returns exit code
```

`main` (not exported) builds real deps and `process.exit(await run(process.argv.slice(2), deps))`. Flag parsing: `--range <r>`, `--rubric <p>`, `--comment`, `--strict` (unknown flags → error + exit 2).

`--comment` behavior: upsert via `gh` — `deps.exec` is used for ALL shell-outs so tests fake it. Sequence: `gh pr view --json number -q .number` (throws → no PR context → warn via `deps.error`, still return 0); list comments `gh api repos/{owner}/{repo}/issues/<n>/comments --jq '[.[] | select(.body | startswith("<!-- principles-evidence-judge -->")) ] | first | .id'`; if an id comes back, PATCH it via `gh api -X PATCH ... -f body=@-`; else `gh pr comment <n> --body-file -`. To keep it testable and simple, write the body to a temp file via `deps.readFile`'s sibling — NO: keep zero temp files; pass body with `-f body=<body>` / `--body <body>` through `deps.exec` with proper shell quoting via a helper `shellQuote(s)` (single-quote wrapping with `'\''` escaping). Tests assert the exec-call sequence.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/scripts/judgeDiff.test.ts
import { describe, it, expect } from "vitest";
import { run, JudgeDiffDeps } from "../../src/scripts/judgeDiff";
import { Llm } from "../../src/llm/gateway";

const rubricJson = JSON.stringify({
  objective: "review a code change",
  criteria: [{ id: "c-t1", source: "truth", truthId: "t1", description: "d", evidenceGuidance: "g" }],
  truths: [], assumptions: [], rejectedTruths: [],
  decomposition: { status: "converged", iterations: 1 },
  gradeability: { status: "converged", iterations: 1 },
  generatedAt: "2026-07-03T00:00:00.000Z", model: "claude-opus-4-8",
});

const passLlm: Llm = (async () => ({
  verdicts: [{ criterionId: "c-t1", pass: true, evidence: "evidence long enough here" }],
})) as unknown as Llm;
const failLlm: Llm = (async () => ({
  verdicts: [{ criterionId: "c-t1", pass: false, evidence: "src/x.ts changed, no tests" }],
})) as unknown as Llm;

const makeDeps = (over: Partial<JudgeDiffDeps> = {}): { deps: JudgeDiffDeps; out: string[]; err: string[]; execs: string[] } => {
  const out: string[] = []; const err: string[] = []; const execs: string[] = [];
  const deps: JudgeDiffDeps = {
    llm: passLlm,
    exec: (cmd) => { execs.push(cmd); if (cmd.startsWith("git diff")) return "diff --git a/x b/x\n+line"; return ""; },
    readFile: () => rubricJson,
    log: (s) => out.push(s),
    error: (s) => err.push(s),
    ...over,
  };
  return { deps, out, err, execs };
};

describe("run", () => {
  it("judges the default range and prints the table, exit 0", async () => {
    const { deps, out, execs } = makeDeps();
    const code = await run([], deps);
    expect(code).toBe(0);
    expect(execs[0]).toBe("git diff origin/main...HEAD");
    expect(out.join("\n")).toContain("| `c-t1` | ✅ PASS |");
  });

  it("--strict exits 1 on failures, 0 on all-pass", async () => {
    const failing = makeDeps({ llm: failLlm });
    expect(await run(["--strict"], failing.deps)).toBe(1);
    const passing = makeDeps();
    expect(await run(["--strict"], passing.deps)).toBe(0);
  });

  it("empty diff → notice, exit 0, no LLM call", async () => {
    let llmCalled = false;
    const { deps, out } = makeDeps({
      llm: (async () => { llmCalled = true; return { verdicts: [] }; }) as unknown as Llm,
      exec: (cmd) => (cmd.startsWith("git diff") ? "" : ""),
    });
    expect(await run([], deps)).toBe(0);
    expect(llmCalled).toBe(false);
    expect(out.join("\n").toLowerCase()).toContain("no changes");
  });

  it("missing rubric file → exit 2 naming the regeneration command", async () => {
    const { deps, err } = makeDeps({ readFile: () => { throw new Error("ENOENT"); } });
    expect(await run([], deps)).toBe(2);
    expect(err.join("\n")).toContain("compile-rubric");
  });

  it("git failure → exit 2", async () => {
    const { deps } = makeDeps({ exec: () => { throw new Error("bad range"); } });
    expect(await run(["--range", "a...b"], deps)).toBe(2);
  });

  it("unknown flag → exit 2", async () => {
    const { deps, err } = makeDeps();
    expect(await run(["--bogus"], deps)).toBe(2);
    expect(err.join("\n")).toContain("--bogus");
  });

  it("--comment upserts: creates when no marker comment exists", async () => {
    const { deps, execs } = makeDeps({
      exec: (cmd) => {
        if (cmd.startsWith("git diff")) return "diff --git a/x b/x\n+line";
        if (cmd.includes("pr view")) return "42";
        if (cmd.includes("issues/42/comments")) return ""; // no existing marker comment
        return "";
      },
    });
    expect(await run(["--comment"], deps)).toBe(0);
    expect(execs.some((c) => c.includes("pr comment 42"))).toBe(true);
  });

  it("--comment updates in place when the marker comment exists", async () => {
    const { deps, execs } = makeDeps({
      exec: (cmd) => {
        if (cmd.startsWith("git diff")) return "diff --git a/x b/x\n+line";
        if (cmd.includes("pr view")) return "42";
        if (cmd.includes("issues/42/comments") && !cmd.includes("PATCH")) return "9001";
        return "";
      },
    });
    expect(await run(["--comment"], deps)).toBe(0);
    expect(execs.some((c) => c.includes("-X PATCH") && c.includes("comments/9001"))).toBe(true);
    expect(execs.some((c) => c.includes("pr comment"))).toBe(false);
  });

  it("--comment without PR context warns and exits 0", async () => {
    const { deps, err } = makeDeps({
      exec: (cmd) => {
        if (cmd.startsWith("git diff")) return "diff --git a/x b/x\n+line";
        if (cmd.includes("pr view")) throw new Error("no PR");
        return "";
      },
    });
    expect(await run(["--comment"], deps)).toBe(0);
    expect(err.join("\n").toLowerCase()).toContain("pr context");
  });
});
```

- [ ] **Step 2: Run to verify RED** — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/scripts/judgeDiff.ts
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import { execSync } from "child_process";
import fs from "fs";
import { Llm } from "../llm/gateway";
import { makeClaudeAgentSdkLlm } from "../llm/claudeGateway";
import { failures } from "../shared/types";
import { loadRubricCriteria, judgeDiff, renderVerdictTable, COMMENT_MARKER } from "../core/diffJudge";

export interface JudgeDiffDeps {
  llm: Llm;
  exec: (cmd: string) => string;
  readFile: (p: string) => string;
  log: (s: string) => void;
  error: (s: string) => void;
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

interface Flags { range: string; rubric: string; comment: boolean; strict: boolean; }

function parseArgs(argv: string[]): Flags | { badFlag: string } {
  const flags: Flags = { range: "origin/main...HEAD", rubric: ".github/review-rubric.json", comment: false, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--range") flags.range = argv[++i] ?? flags.range;
    else if (a === "--rubric") flags.rubric = argv[++i] ?? flags.rubric;
    else if (a === "--comment") flags.comment = true;
    else if (a === "--strict") flags.strict = true;
    else return { badFlag: a };
  }
  return flags;
}

function upsertComment(deps: JudgeDiffDeps, body: string): void {
  let prNumber: string;
  try {
    prNumber = deps.exec("gh pr view --json number -q .number").trim();
    if (!prNumber) throw new Error("empty");
  } catch {
    deps.error("No PR context available for --comment; printed table only.");
    return;
  }
  const existing = deps
    .exec(
      `gh api "repos/{owner}/{repo}/issues/${prNumber}/comments" --jq '[.[] | select(.body | startswith("${COMMENT_MARKER}"))] | first | .id' 2>/dev/null || true`
    )
    .trim();
  if (existing && existing !== "null") {
    deps.exec(`gh api -X PATCH "repos/{owner}/{repo}/issues/comments/${existing}" -f body=${shellQuote(body)}`);
  } else {
    deps.exec(`gh pr comment ${prNumber} --body ${shellQuote(body)}`);
  }
}

export async function run(argv: string[], deps: JudgeDiffDeps): Promise<number> {
  const parsed = parseArgs(argv);
  if ("badFlag" in parsed) {
    deps.error(`Unknown flag: ${parsed.badFlag}. Usage: judge-diff [--range a...b] [--rubric path] [--comment] [--strict]`);
    return 2;
  }

  let rubric;
  try {
    rubric = loadRubricCriteria(JSON.parse(deps.readFile(parsed.rubric)));
  } catch (e: any) {
    deps.error(`Failed to load rubric at ${parsed.rubric}: ${e.message}. Regenerate with: yarn compile-rubric "<goal>" and copy rubric.json there.`);
    return 2;
  }

  let diff: string;
  try {
    diff = deps.exec(`git diff ${parsed.range}`);
  } catch (e: any) {
    deps.error(`git diff failed for range ${parsed.range}: ${e.message}`);
    return 2;
  }
  if (!diff.trim()) {
    deps.log("No changes to judge in the given range.");
    return 0;
  }

  let judgment;
  try {
    judgment = await judgeDiff(deps.llm, diff, rubric);
  } catch (e: any) {
    deps.error(`Judging failed: ${e.message}`);
    return 2;
  }

  const table = renderVerdictTable(judgment);
  deps.log(table);
  if (parsed.comment) upsertComment(deps, table);
  if (parsed.strict && failures(judgment.critique).length > 0) return 1;
  return 0;
}

/* istanbul ignore next -- thin binding, covered by the live gate */
if (require.main === module) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set — relying on local Claude Code credentials if available.");
  }
  const deps: JudgeDiffDeps = {
    llm: makeClaudeAgentSdkLlm(),
    exec: (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }),
    readFile: (p) => fs.readFileSync(path.resolve(p), "utf8"),
    log: console.log,
    error: console.error,
  };
  run(process.argv.slice(2), deps).then((code) => process.exit(code));
}
```

In `package.json` scripts, after `compile-rubric`:

```json
"judge-diff": "yarn build && node dist/scripts/judgeDiff.js",
```

- [ ] **Step 4: Run tests, build, full suite** — green.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/judgeDiff.ts tests/scripts/judgeDiff.test.ts package.json
git commit -m "feat: judge-diff CLI with injectable deps, strict mode, and comment upsert"
```

---

### Task 4: Workflow and docs

**Files:**
- Create: `.github/workflows/judge.yml`
- Modify: `CLAUDE.md` (Commands + rubric-maintenance note)

**Interfaces:** consumes `yarn judge-diff --comment` from Task 3. No exports.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/judge.yml
name: evidence-judge
on: pull_request
permissions:
  pull-requests: write
  contents: read
concurrency:
  group: judge-${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  judge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: yarn install --frozen-lockfile
      - name: Judge or notice
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ github.token }}
        run: |
          if [ -z "$ANTHROPIC_API_KEY" ]; then
            BODY='<!-- principles-evidence-judge -->
          ### Evidence judge (advisory)

          Not configured: add an `ANTHROPIC_API_KEY` repository secret to enable rubric-based diff judging on PRs.'
            EXISTING=$(gh api "repos/${{ github.repository }}/issues/${{ github.event.pull_request.number }}/comments" --jq '[.[] | select(.body | startswith("<!-- principles-evidence-judge -->"))] | first | .id' 2>/dev/null || true)
            if [ -n "$EXISTING" ] && [ "$EXISTING" != "null" ]; then
              gh api -X PATCH "repos/${{ github.repository }}/issues/comments/$EXISTING" -f body="$BODY"
            else
              gh pr comment ${{ github.event.pull_request.number }} --body "$BODY"
            fi
            exit 0
          fi
          yarn judge-diff --range "origin/${{ github.base_ref }}...HEAD" --comment
```

- [ ] **Step 2: Update CLAUDE.md**

In Commands, after the `compile-rubric` line, add:

```markdown
- `yarn judge-diff` — grade a diff against `.github/review-rubric.json` (advisory; CI posts it on PRs). Regenerate the rubric with `yarn compile-rubric` and copy `rubric.json` over `.github/review-rubric.json` when invariants change.
```

- [ ] **Step 3: Validate + commit**

Run: `yarn build && yarn test` (unchanged, must stay green). Visually confirm the workflow YAML indentation (heredoc body is inside the `run: |` block).

```bash
git add .github/workflows/judge.yml CLAUDE.md
git commit -m "feat: advisory evidence-judge workflow with graceful no-secret notice"
```

---

### Task 5: Compile and check in the review rubric (live, needs credentials)

**Files:**
- Create: `.github/review-rubric.json` (generated artifact)

- [ ] **Step 1: Compile it** (observably, per the live-verification skill):

```bash
CLAUDE_ENABLE_STREAM_WATCHDOG=1 CLAUDE_STREAM_IDLE_TIMEOUT_MS=120000 \
  yarn compile-rubric "review a code change (presented as a unified git diff) to the Principles framework repository for violations of the repo's invariants, untested behavior changes, and unjustified complexity" \
  > judge-rubric-run.log 2>&1
```

- [ ] **Step 2: Review the output** — read the assumptions/rejections/statuses in the log and the generated `rubric.md` by eye; if the rubric's criteria are off-target for diff review (e.g. demand things a diff can't show), refine the goal wording once and re-run.

- [ ] **Step 3: Install and commit**

```bash
cp rubrics/review-a-code-change-*/rubric.json .github/review-rubric.json
git add .github/review-rubric.json
git commit -m "feat: compiled review rubric for the evidence judge"
```

---

### Task 6: Live gate — judge a real historical diff

**Files:** none (manual gate; findings in PR description).

- [ ] **Step 1:** `yarn judge-diff --range 200846c...794b5f6` (the compile-rubric build itself) — expect a verdict table whose evidence cites real files from that diff (e.g. `src/core/rubricCompiler.ts`).
- [ ] **Step 2:** Sanity checks: `yarn judge-diff --range HEAD...HEAD` prints the no-changes notice; `--strict` on a range with a genuine FAIL exits 1 (`echo $?`).
- [ ] **Step 3:** Fix anything found (TDD per fix), commit.

---

## Self-Review Notes

- **Spec coverage:** deferred minors (T1), core logic + cap + table + marker (T2), CLI flags/exit codes/upsert/no-PR-context (T3), workflow + graceful no-secret + docs (T4), compiled checked-in rubric (T5), live gate incl. --strict and empty-diff (T6).
- **Placeholder scan:** clean; T5/T6 are manual gates with exact commands.
- **Type consistency:** `run(argv, deps)`/`JudgeDiffDeps` match between T3 code and tests; `COMMENT_MARKER` defined T2, consumed T3+T4 (workflow hardcodes the same literal — acceptable duplication across YAML/TS, noted here so reviewers don't flag drift blindly); `loadRubricCriteria` returns `CompiledRubric` consumed by `judgeDiff(llm, diff, rubric)`.
- **Judgment calls:** no zod for the local rubric file (hand validation with actionable errors — it's our own artifact, not model output); comment body passed via shell-quoted `--body`/`-f body=` rather than temp files; `gh` jq startswith on the marker requires the marker to be the FIRST line of the body — renderVerdictTable puts it first by construction.
