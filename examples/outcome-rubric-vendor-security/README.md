# Example: compiled outcome rubric — vendor security review

A gradeable rubric compiled by `yarn compile-rubric` (2026-07-03) for the goal:

> *evaluate whether a vendor proposal satisfies our security requirements*

This is the artifact shape intended for outcome-driven agents — e.g. Anthropic Managed Agents' `user.define_outcome`, whose grader iterates a session until the rubric passes. The chronic problem with that loop is vibes-based rubrics; this one was **derived from vetted truths and judged against its own meta-rubric** before you ever see it.

## What's here

| file | what it is |
|---|---|
| `rubric.md` | the grader-facing rubric: 6 criteria, each with an explicit *Evidence required* rule (PASS/FAIL conditions, citation demands, even a count-check that verdicts map one-to-one to requirements) |
| `rubric.json` | canonical form with full provenance: every criterion traces to the truth or subtask it came from; assumptions and the skeptic's rejected truths are recorded; both loop statuses (`decomposition`, `gradeability`) included |
| `generation-report.md` | verbatim compile console: 4 surfaced assumptions, 2 truths rejected with counterexamples (including an N-of-M weighted-gating counterexample against "only mandatory requirements may gate the verdict"), decomposition converged in 1 iteration, gradeability in 2 |

## The part worth studying: the rubric passed its own rubric

`compile-rubric` runs a **gradeability meta-check**: the draft rubric is judged against meta-criteria (each criterion independently gradeable; criteria non-overlapping; nothing out of scope) and revised until it converges. In this compile that loop ran twice — and you can see its fingerprints in `rubric.md`: the *"this criterion is the SINGLE home for…"* scoping language exists because the `m-independent` meta-criterion forced overlapping criteria to consolidate. The revision may reword or drop criteria but can never invent them, and provenance fields are reattached in code, not by the model.

## Use it

```bash
yarn compile-rubric "<your goal>"   # ~10–25 Opus calls, a few minutes
# rubric.md → paste as an Outcome rubric; rubric.json → keep for provenance/audit
```
