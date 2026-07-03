# examples-gallery — Design Spec

**Date:** 2026-07-03
**Status:** Approved by user (capstone proposal conversation)
**Builds on:** web-tools-evaluators (merged as `c0da344`)

## Purpose

Replace the stale 2024 `examples/` (legacy-era output referencing deleted code) with three real, provenance-complete demonstrations of the current system — the evidence base for the journey article. This is an artifact-curation cycle, not a code cycle: no production source changes; process is proportionate (this spec, direct execution, one final review before PR).

## Layout

```
examples/
  README.md                                   # gallery index: what each shows, how to regenerate, cost/time expectations
  study-credibility-evaluator/                # web-enabled evaluator (from build 3's live gate — reused, already verified)
    README.md                                 # traces one criterion truth → subtask → agent → judged output; notes the [caution]/web mechanics
    ontology.json
    generation-report.md                      # console: assumptions, rejected truths (verbatim), statuses
    run-ioannidis.md                          # the real-URL run: prompt + full answer
  lease-reviewer/                             # NEW generation + run (the one live-cost item)
    README.md
    ontology.json
    generation-report.md
    sample-lease.md                           # authored sample with deliberately tenant-hostile clauses
    run-sample-lease.md                       # prompt + full output incl. any [caution] lines
  outcome-rubric-vendor-security/             # compiled rubric artifact (from build 2's live gate — reused)
    README.md                                 # how to attach it to a Managed Agents outcome; what the meta-check did (criterion consolidation)
    rubric.md
    rubric.json
    generation-report.md
```

Legacy `examples/credibility-evaluator-agents/` and `examples/microservice-design-agents/` are deleted (`git rm -r`).

## Sourcing

- Study evaluator: `packages/agent-package-1783096728976` + `.superpowers/sdd/webgen.log` + the in-frame run output (task log) — copy, not regenerate.
- Vendor rubric: `rubrics/evaluate-whether-a-vendor-proposal-satis-1783087073970/` + its compile log.
- Lease reviewer: one live `generate-agents` run with goal "review a residential lease for terms unfavorable to the tenant, citing the specific clause for every concern" + one live run against the authored sample lease. Sample lease contains ≥6 planted hostile clauses (e.g. automatic renewal with 90-day notice window, landlord entry without notice, tenant pays all repairs regardless of cause, deposit forfeiture conditions, unilateral rent escalation, jury-trial waiver) so the run output can be checked against known ground truth.

## Quality bar (checked in the final review)

- Every README claim traceable to a shipped artifact in the same directory; no invented content — generation-report files are verbatim console output (ANSI-stripped).
- The gallery README states honestly what each run cost (approx. calls/minutes) and that outputs are model-generated and dated.
- Lease run must flag ≥4 of the planted clauses to ship as-is; misses are documented in its README either way (honest gallery, not a highlight reel).
- No source-code changes anywhere; `yarn build && yarn test` untouched-green.

## Out of scope

The journey article itself (separate deliverable, follows this); regenerating the study/vendor artifacts; CMA API calls.
