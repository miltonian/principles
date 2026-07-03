# ci-evidence-judge — Design Spec

**Date:** 2026-07-03
**Status:** Approved by user (design conversation; standing authorization covers spec→build)
**Builds on:** compile-rubric (merged as `794b5f6`)

## Purpose

Dogfood the evidence machinery on this repo's own development: every PR gets its diff graded criterion-by-criterion against a **compiled** review rubric, with the verdict table posted as an advisory PR comment. Build 2 of the three-build sequence (rubric compiler → CI judge → web-tools demo).

## User-visible behavior

```bash
yarn judge-diff                          # grades origin/main...HEAD against .github/review-rubric.json
yarn judge-diff --range <a>...<b>        # explicit range
yarn judge-diff --rubric <path>          # explicit rubric
yarn judge-diff --comment                # additionally post/update the PR comment via gh
yarn judge-diff --strict                 # exit 1 when any criterion fails (NOT used by CI)
```

Console: a markdown verdict table (criterion id, PASS/FAIL, evidence) plus a truncation notice when the diff exceeds the size cap. Exit 0 always, except `--strict` with ≥1 failure → exit 1; infrastructure errors (missing rubric, bad range, LLM failure) → exit 2 with a clear message.

GitHub: `.github/workflows/judge.yml` runs on `pull_request`, posts one comment per PR (updated in place on subsequent pushes, keyed by a hidden HTML marker `<!-- principles-evidence-judge -->`). When the `ANTHROPIC_API_KEY` secret is absent, the workflow posts/updates a notice comment saying the judge is not configured, and exits 0 (green) — it must never fail every fork/secretless PR.

## The rubric artifact

- Generated at execution time by `yarn compile-rubric` with the goal: **"review a code change (presented as a unified git diff) to the Principles framework repository for violations of the repo's invariants, untested behavior changes, and unjustified complexity"** — wording may be tuned during the live step; the goal string used is recorded in the artifact itself (`objective` field).
- Checked in at `.github/review-rubric.json` (the intentional exception to `rubrics/` being gitignored; no gitignore change needed since `.github/` isn't ignored).
- Maintenance is documented in CLAUDE.md: regenerate with one command, review the diff of the artifact, commit.

## Architecture

### `src/scripts/judgeDiff.ts` (CLI) + `src/core/diffJudge.ts` (logic)

Separation: `diffJudge.ts` is pure/injectable logic (unit-testable), `judgeDiff.ts` is the thin CLI mirroring existing script conventions (dotenv first, warn-not-exit on missing key, `makeClaudeAgentSdkLlm()`).

```ts
// src/core/diffJudge.ts
export const DIFF_CHAR_CAP = 120_000; // ~30k tokens; loud truncation beyond
export interface DiffJudgment {
  critique: Critique;                 // from shared judge()
  truncated: boolean;
  rubricObjective: string;
  criteriaCount: number;
}
export function buildCandidate(diff: string): { candidate: string; truncated: boolean }
export function loadRubricCriteria(rubricJson: unknown): Criterion[]   // validates CompiledRubric shape minimally; throws descriptive error on mismatch
export async function judgeDiff(llm: Llm, diff: string, rubric: CompiledRubric): Promise<DiffJudgment>
export function renderVerdictTable(j: DiffJudgment): string            // markdown: header note (advisory), truncation notice when set, | criterion | verdict | evidence | rows, footer with objective + hidden marker comment
```

- `buildCandidate`: prefixes the diff with a one-line framing ("Unified git diff under review:"), truncates at `DIFF_CHAR_CAP` on a line boundary, appends `[diff truncated at N chars]` when cut.
- `judgeDiff`: `judge(llm, { rubric: rubric.criteria, candidate, context })` where context names the repo, the rubric objective, and instructs that evidence must cite file paths/hunks from the diff. Reuses `judge()`'s code-enforced evidence rules unchanged.
- `renderVerdictTable`: pure; escapes `|` in evidence; PASS/FAIL as ✅/❌ plus text; includes `<!-- principles-evidence-judge -->` marker for comment-upsert.

### CLI flag handling

Minimal hand-rolled argv parsing (no new deps): `--range`, `--rubric`, `--comment`, `--strict`. Defaults: range `origin/main...HEAD`, rubric `.github/review-rubric.json`. Diff obtained via `git diff <range>` (child_process execSync; empty diff → prints "no changes to judge", exit 0). `--comment` shells out to `gh` to upsert the marker-keyed comment on the current PR (`gh pr comment --edit-last` semantics implemented via `gh api` list+update/create; if `gh` or PR context is unavailable, print the table and a warning, still exit 0).

### Workflow `.github/workflows/judge.yml`

- `on: pull_request`; permissions `pull-requests: write, contents: read`; concurrency per-PR.
- Steps: checkout (fetch-depth 0), setup-node 20, `yarn install --frozen-lockfile`, then a step that checks the secret: absent → upsert the not-configured notice comment, exit 0; present → `yarn judge-diff --range origin/${{ github.base_ref }}...HEAD --comment` with `ANTHROPIC_API_KEY` from secrets and `GITHUB_TOKEN` for `gh`.

### In-scope deferred minors from build 1's final review

1. `CompiledRubric.decomposition/gradeability.status` typed as the `"converged" | "escalated" | "exhausted"` union (flows from `RefineOutcome`); `gradeabilityCheck`'s return likewise.
2. `gradeabilityCheck` surfaces `stuckOn?: string[]` (from escalated outcomes) and the compile-rubric CLI prints the stuck meta-criterion ids on escalation.

## Invariants honored

- All model calls via injected `Llm` (the judge reuses `judge()`); no new schemaNames.
- No changes to `src/shared|llm|runtime` except none needed — diffJudge lives in `src/core` (generation-side, not copied into packages).
- Never silently bless: truncation is loud; missing-secret is a visible notice; `--strict` exists for anyone who wants teeth.

## Error handling

- Missing/invalid rubric file: exit 2, message naming the path and the regeneration command.
- Bad git range/`git diff` failure: exit 2 with stderr passthrough.
- LLM failure after gateway retries: exit 2 (CI shows the failure; advisory comment simply doesn't update — acceptable).
- `--comment` without PR context: warn + table to stdout + exit 0.

## Testing

Network-free with fakes: `buildCandidate` (cap, line-boundary, notice), `loadRubricCriteria` (happy + malformed), `judgeDiff` (context contents, critique passthrough), `renderVerdictTable` (marker present, escaping, truncation note, pass/fail rows), CLI exit codes for `--strict` (via exported `run(argv, deps)` with injected exec/llm — thin main only calls it). Workflow YAML validated by inspection (no unit harness for Actions). Live gate: run `yarn judge-diff` against a real historical range from this repo (e.g. the compile-rubric branch diff) with the freshly compiled rubric; verify the table's evidence cites real files.

## Out of scope

Blocking mode as CI policy; judging commit messages; multi-rubric routing; posting inline review comments (single summary comment only); fork-PR secret plumbing beyond the graceful notice.
