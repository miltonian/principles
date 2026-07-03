# compile-rubric — Design Spec

**Date:** 2026-07-03
**Status:** Approved by user (design conversation); pending spec review
**Builds on:** the mechanism-over-theater rework (merged as `200846c`)

## Purpose

A new product surface for the Principles framework: compile a plain-language goal into an **adversarially-vetted, evidence-gradeable rubric** — the artifact people deploying outcome-driven agents (e.g. Anthropic Managed Agents' `user.define_outcome`) need and don't know how to write. This is deliverable #1 of a three-build sequence (rubric compiler → CI judge dogfood → web-tools demo); the other two get their own specs later.

## User-visible behavior

```bash
yarn compile-rubric "evaluate whether a vendor proposal satisfies our security requirements"
```

Console output: surfaced assumptions ("proceeding as if — correct me if wrong"), rejected candidate truths with their counterexamples, decomposition convergence status, gradeability-check status, and the output paths.

Artifacts, written to `rubrics/<slug>-<timestamp>/`:

- **`rubric.md`** — human/agent-facing rubric formatted for the Managed Agents Outcome API rubric field: a title, one-line usage note, then explicit, independently gradeable criteria grouped as **Hard constraints** (from constraint truths) and **Completeness** (from subtasks), each with an *Evidence required* line. No prose padding — every line is a criterion or its evidence guidance.
- **`rubric.json`** — canonical machine form with full provenance:

```jsonc
{
  "objective": "…",
  "criteria": [
    {
      "id": "c-t3",              // or "c-s7" for subtask-derived
      "description": "…",
      "source": "truth" | "subtask" | "generic",
      "truthId": "t3",            // when source === "truth"
      "subtaskId": "s7",          // when source === "subtask"
      "evidenceGuidance": "…"     // what a grader must see before passing this criterion
    }
  ],
  "truths": [...],                // kept truths (typed)
  "assumptions": [...],           // demoted truths, surfaced
  "rejectedTruths": [{"statement": "…", "attack": "…"}],
  "gradeability": { "status": "converged|escalated|exhausted", "iterations": n },
  "generatedAt": "ISO", "model": "claude-opus-4-8"
}
```

`slug` = first ~40 chars of the objective, kebab-cased.

## Architecture

### Shared foundation extraction (refactor)

Extract the front half of `generateOntology` (`src/core/pipeline.ts`) into:

```ts
// src/core/foundations.ts
export interface Foundations {
  truths: Truth[];          // kept + assumptions combined (working set)
  vet: VetResult;           // kept / assumptions / rejected split
  subtasks: Subtask[];
  decomposition: RefineOutcome<Subtask[]>;
}
export async function deriveFoundations(llm: Llm, objective: string): Promise<Foundations>
```

Contents: `deriveTruths` → `vetTruths` → throw on zero survivors (same message contract as today) → `refine(decompose, coverage-first two-stage judge)` — moved verbatim from `pipeline.ts`. `generateOntology` becomes `deriveFoundations` + spec generation + ontology assembly; its behavior and every existing test stay unchanged. The rubric compiler consumes `deriveFoundations` and stops there (no agent specs — ~⅓ fewer calls than a package compile).

### Rubric construction (`src/core/rubricCompiler.ts`)

```ts
export interface CompiledCriterion extends Criterion {
  subtaskId?: string;
  evidenceGuidance: string;
}
export interface CompiledRubric {
  objective: string;
  criteria: CompiledCriterion[];
  truths: Truth[]; assumptions: Truth[];
  rejectedTruths: { statement: string; attack: string }[];
  gradeability: { status: string; iterations: number };
  generatedAt: string; model: string;
}
export async function compileRubric(llm: Llm, objective: string, now?: () => Date): Promise<CompiledRubric>
```

1. `deriveFoundations(llm, objective)`.
2. Assemble draft criteria: constraint truths → hard-constraint criteria (reuse `outputRubric`-style mapping, ids `c-<truthId>`); subtasks → completeness criteria (`c-<subtaskId>`, description "The deliverable adequately addresses: <subtask description>"). Generic criteria (`o-responsive`, `o-grounded` equivalents) included as a third group.
3. **Evidence guidance** — ONE batched LLM call (schemaName `rubric_guidance`): input = objective + criteria list; output = `{ guidance: [{criterionId, evidenceGuidance}] }`. Mechanical post-check in code: any criterion missing from the response gets guidance `"Cite the specific passage(s) of the deliverable that satisfy this criterion."` (safe default, never blocks).
4. **Gradeability meta-check** — `refine()` loop (maxIterations 3) where:
   - candidate = the rendered rubric text,
   - judge = existing `judge()` against a fixed META_RUBRIC (pure data, no LLM to build): `m-gradeable` ("each criterion can be marked pass/fail by pointing at evidence in a deliverable, without needing information the grader won't have"), `m-independent` ("criteria do not substantially overlap; no deliverable property is double-counted"), `m-scoped` ("no criterion demands work outside the objective's scope").
   - produce = a revision LLM call (schemaName `rubric_revision`) that receives the current criteria + failed verdicts with evidence + passing criteria to preserve, and returns revised criteria descriptions/guidance (ids immutable; it may revise text and DROP criteria, never add).
   - Mechanical post-check after each revision: ids ⊆ original ids; provenance fields untouched.
5. Non-converged gradeability is reported in `gradeability.status` and printed loudly — same philosophy as generation: never silently bless.

### Rendering (`src/core/rubricRender.ts`)

Pure functions, no LLM (mechanical = cannot hallucinate):
- `renderRubricMarkdown(rubric: CompiledRubric): string`
- `renderRubricJson(rubric)` = stable-ordered JSON.

### CLI (`src/scripts/rubricCli.ts` + package.json script `compile-rubric`)

Mirrors `agentGenerator.ts`: dotenv, key warning (not exit), `makeClaudeAgentSdkLlm()`, run, print report, write artifacts with `fs-extra`.

## Invariants honored (CLAUDE.md)

- All LLM calls through the `Llm` gateway; new schemaNames `rubric_guidance` and `rubric_revision` join the load-bearing list (CLAUDE.md updated in the same change).
- All schemas structured-output-safe (closed objects, no `$schema`).
- `rubrics/` added to `.gitignore` (generated artifacts, like `packages/`).
- `src/core/` is generation-side only; nothing in `src/shared|llm|runtime` changes except the `Criterion.source` union gaining `"subtask"` (additive; existing tests unaffected).

## Error handling

- Zero surviving truths: same throw as generation (message contains "No truths survived").
- Foundations decomposition escalated/exhausted: proceed + loud report (existing behavior).
- Gradeability escalated/exhausted: proceed + loud report + status in JSON.
- Revision returning unknown criterion ids: the revision is discarded and the previous candidate is kept for that iteration (silently filtering bad ids would be a silent bless). A kept-candidate iteration re-fails the same criteria, so `refine()`'s repeated-failure escalation terminates the loop naturally.

## Testing

Network-free with injected fake `Llm` (established pattern):
- `foundations.test.ts` — extraction equivalence: scripted-fake run of `deriveFoundations` produces the same truths/subtasks the pipeline test expects; `generateOntology` scripted test unchanged and still green.
- `rubricCompiler.test.ts` — criteria assembly (sources/ids/provenance), guidance batching + missing-guidance default, meta-check revise loop (converge / escalate paths), id-immutability enforcement, drop-allowed/add-forbidden.
- `rubricRender.test.ts` — markdown contains groups, every criterion, every evidence line; JSON round-trips.
- CLI covered by one emit-style tmp-dir test (writes both files, prints paths).
- Final gate: one live compile of the spec's own example goal ("evaluate whether a vendor proposal satisfies our security requirements"), monitored with the stage-probe playbook from `.claude/skills/live-verification`; verify both artifacts by eye against the rubric.md format contract above.

## Out of scope

Managed Agents API calls (we emit artifacts only); grading deliverables against compiled rubrics (that's build #2's judge surface); web tools (build #3); `--fast` truths-only mode (YAGNI until requested).
