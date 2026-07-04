# deliverable-framing — Design Spec (v3)

**Date:** 2026-07-04
**Status:** Approved by user
**Builds on:** synthesis-contract (v2, in flight). v2 official partials: 4 wins on report-genre tasks, blowout losses concentrated where package weight is 28–49% (`.superpowers/sdd/analysis-genre-vs-content.md`). Diagnosis: (1) genre blindness — no truths about the ARTIFACT; (2) framing funnel — everything downstream cites truths, so a narrow frame is unrecoverable; (3) both are truth-derivation/decomposition properties, not runtime ones.

## Purpose

Widen the front of the funnel: derive truths about the *deliverable* alongside truths about the *subject*, and force decomposition to map the topic's breadth explicitly (cover or visibly exclude). No new machinery — the existing skeptic/coverage/judge/contract mechanisms extend to the new truths automatically because they are ordinary constraint truths.

**Integrity boundary:** designed from the v1/v2 failure pattern only. The "expert checklist instinct" is a general prompt, never informed by any benchmark rubric's contents.

## Changes (generation-side only: `src/core/`; zero runtime changes)

### 1. Artifact truths — `src/core/truths.ts`

System prompt gains one block (after the type list):

```
Derive truths about TWO subjects: the topic itself, AND the deliverable the
objective asks for. For the deliverable, ask: what KIND of artifact is this
(report, design doc, creator kit, outline, story, brief)? What parts does
that kind of artifact ALWAYS contain in professional practice? What register
and audience does it imply? State these as constraint truths about the
deliverable (e.g. "The deliverable is a video-creator kit; such kits include
a shot-by-shot script, a title, and platform furniture — and casual register:
academic citation style is out of place").
```

No schema change (`typed_truths` untouched); artifact truths are ordinary `constraint` rows the skeptic attacks like any other. Prompt-content test.

### 2. Breadth mapping — `src/core/decompose.ts` + `src/core/rubric.ts`

- Decomposition schema gains a required top-level field `coverageMap: z.array(z.object({ dimension: z.string(), handledBy: z.string(), exclusionReason: z.string() }))` — every major dimension an expert treatment of the topic would cover, each either `handledBy` a subtask index/id or carrying a non-empty `exclusionReason` (`handledBy` empty string when excluded; both fields required strings, empty = n/a; structured-output-safe).
- Prompt rule: "First enumerate the major dimensions an expert, comprehensive treatment of this topic would cover — the survey instinct. Every dimension must be handled by a subtask or explicitly excluded with a reason. Silent narrowing is the failure mode you exist to prevent."
- Mechanical check `cov-breadth` in `src/core/coverage.ts`: every coverageMap row has `handledBy` naming a real subtask XOR a non-empty `exclusionReason`; rows failing → ids in the verdict (same free-check pattern as `cov-web-justified`).
- Judged criterion `d-breadth` appended after `d-web` in `decompositionRubric`: "The coverage map genuinely spans what an expert treatment would include; exclusions are reasoned, not convenient; the subtasks do not silently narrow the objective."
- `Subtask`/ontology types: `GenerationReport.decomposition` already carries subtasks; `coverageMap` rides on the decomposition result → stored in ontology as `coverageMap?: { dimension: string; handledBy: string; exclusionReason: string }[]` (additive, optional — old ontologies unaffected). The synthesis contract builder MAY later consume it; out of scope now.

### 3. Contract genre upgraded — `src/runtime/contract.ts` consumers unchanged; `src/runtime/orchestrator.ts` one-line change

`buildContract` currently takes triage's guessed genre. Now: if the ontology contains an artifact-truth-derived genre… **simplest faithful wiring:** no new plumbing — triage already reads the ontology (objective + agents) when guessing `deliverableGenre`; with artifact truths present in `ontology.truths`, extend the planner prompt with one line: "If the truths name the deliverable kind/register, adopt that as the genre — do not re-guess." Runtime code unchanged beyond this prompt line (planner.ts). (Rejected alternative: structured genre field on Ontology — more plumbing, no more falsifiability.)

## Pre-registered predictions (falsifiable, recorded before any v3 run)

1. YouTube-short task (v2: 0.509) and alignment task (v2: 0.395) recover ≥ half their gap to bare (0.891 / 0.698).
2. The four v2 report-genre wins stay wins (±0.05 noise band).
3. If (1) fails, the framing thesis is wrong at this layer too — publish that.

## Rerun protocol

v3 = same locked manifest, principles arm only, bare frozen at 0.669; v2 artifacts preserved (`v2-*` dirs) like v1's. Grading ≈ $8–10 (long documents). Smoke = the YouTube task first this time (highest package weight — fastest signal on the artifact-truth mechanism), read by eye before the rest run.

## Testing (network-free)

truths: prompt contains the artifact-truth block; existing parse/mapping untouched. decompose: coverageMap parsing (handled + excluded rows), prompt rule presence; fixtures across pipeline/foundations/rubricCompiler gain the required field. coverage: `cov-breadth` happy/violation (unknown subtask id in handledBy; both-empty row; both-filled row → violation too: exactly one). rubric: `d-breadth` present after `d-web`; existing id-order tests updated; decomposition-side `rubric_verdicts` fakes gain a `d-breadth` pass verdict (three fixture files, same drill as d-web). planner: prompt line present.

## Out of scope

Runtime changes beyond the planner prompt line; consuming coverageMap in the synthesis contract; any peek at benchmark rubrics; competitor arms.
