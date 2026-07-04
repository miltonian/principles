# deliverable-framing Implementation Plan (v3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Artifact truths + explicit breadth mapping at generation time, per `docs/superpowers/specs/2026-07-04-deliverable-framing-design.md` (pre-registered predictions included there).

**Architecture:** Prompt-block addition in `src/core/truths.ts`; `coverageMap` field + prompt rule in `src/core/decompose.ts`; `cov-breadth` mechanical check in `src/core/coverage.ts`; `d-breadth` criterion in `src/core/rubric.ts`; one prompt line in `src/runtime/planner.ts`. No new schemaNames; `decomposition` schema gains one required field.

**Tech Stack:** existing. **Gate:** implementation must not start until the v2 pilot run reports 10/10 (a mid-run rebuild of `dist/` would contaminate a relaunch).

## Global Constraints

- Generation-side only except the single planner prompt line. `coverageMap` on the ontology is additive/optional. Structured-output-safe: all fields required strings in the zod schema; empty string = not-applicable.
- `cov-breadth` violation = a row where NOT exactly one of {handledBy names a real subtask, exclusionReason non-empty} holds.
- Fixture drill (same as d-web): decomposition-side `rubric_verdicts` fakes in pipeline/foundations/rubricCompiler tests gain a `d-breadth` pass verdict; decomposition fakes gain a `coverageMap` field.
- Branch `synthesis-contract` (continues; v2 and v3 ship as one PR with the full v1→v2→v3 story). `yarn build && yarn test` green at every commit (baseline 141).

---

### Task D1: Artifact truths + planner adoption line

**Files:** Modify `src/core/truths.ts`, `src/runtime/planner.ts`. Tests: append `tests/core/truths.test.ts`, `tests/runtime/planner.test.ts`.

- [ ] **Step 1: Failing tests.** truths: capture the request with a fake llm; assert system contains `"truths about TWO subjects"`, `"what KIND of artifact"`, and `"constraint truths about the deliverable"`; existing mapping tests untouched. planner: assert system contains `"adopt that as the genre"`.
- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement.** truths.ts system gains the spec §1 block verbatim (after the type list, before "Prefer fewer, sharper truths"). planner.ts system gains: `"If the truths name the deliverable kind or register, adopt that as the genre — do not re-guess."` (planner prompt must therefore include truths: it currently lists objective+agents only — ADD a `## Truths` section rendering `ontology.truths` as `- [type] statement` lines to the planner prompt; assert its presence in the planner test.)
- [ ] **Step 4: GREEN + full suite. Step 5: Commit** `feat: artifact truths derived alongside subject truths; planner adopts derived genre`

### Task D2: coverageMap + cov-breadth + d-breadth

**Files:** Modify `src/core/decompose.ts`, `src/core/coverage.ts`, `src/core/rubric.ts`, `src/shared/types.ts` (additive `Ontology.coverageMap?`), `src/core/foundations.ts`/`pipeline.ts` (thread coverageMap into ontology + judge candidate rendering gains a `Coverage map:` section), plus fixture updates. Tests: append decompose/coverage/rubric suites; update pipeline/foundations/rubricCompiler fixtures.

- [ ] **Step 1: Failing tests.** decompose: schema fake returns coverageMap rows (one handled, one excluded); assert parsed through; assert prompt contains "survey instinct" rule and "Silent narrowing". coverage: `cov-breadth` — handled-by-real-subtask passes; unknown id fails; both-empty fails; both-filled fails; verdicts length 7. rubric: id order `[d-minimal, d-feasible, d-complete, d-web, d-breadth, d-t*...]`.
- [ ] **Step 2: RED. Step 3: Implement** per spec §2 (mirror the cov-web-justified/d-web patterns exactly; coverageMap rendered into the decomposition judge candidate so d-breadth is judgeable — same lesson as the d-web blind-judge fix: THE JUDGE MUST SEE IT; add a foundations test asserting the judge prompt contains a coverage-map row).
- [ ] **Step 4: GREEN + full suite (fixtures per Global Constraints). Step 5: Commit** `feat: explicit breadth map at decomposition — cover or visibly exclude`

### Task D3: Live — v3 rerun, grade, publish (controller-run; gated on v2 completion + v2 grading done)

- [ ] Preserve v2 artifacts (`git mv` → `v2-*`), commit.
- [ ] Smoke: watch the YouTube task's v3 output first (highest package weight); read by eye for creator furniture (script table, title, furniture) before letting the rest run.
- [ ] Full arm → grade (stricter any-error guard already in the driver) → README gains the v1→v2→v3 progression table + prediction outcomes (spec's pre-registered list, hit or miss, verbatim) → final whole-branch review (fable, artifact-integrity emphasis) → PR → merge.

## Self-Review Notes

Spec coverage: §1→D1, §2→D2, predictions/rerun→D3. Type consistency: coverageMap shape identical in schema/type/check; `d-breadth` after `d-web` everywhere. Judgment call: coverageMap must reach the decomposition JUDGE's candidate rendering (D2) — that's the d-web blind-judge lesson applied proactively this time.
