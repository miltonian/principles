# grounded-framing — Design Spec (v4)

**Date:** 2026-07-04
**Status:** Approved by user (research-grounded; bias safeguards user-vetted)
**Builds on:** v3 verdict (mean 0.642, 7/10 wins vs bare 0.669) + stage-attribution forensics (`.superpowers/sdd/forensics-{youtube,alignment,haiti}.md`) + research digests (`research-harness2.md`, `research-first-principles.md`).

## Thesis

v1–v3 mechanized *Cartesian* first principles: derive truths from priors, lock the frame, execute flawlessly inside it. Forensics attribute ~80% of residual lost weight to that locked frame. v4 makes the pipeline *Aristotelian*: axioms educed from world contact (Post. An. II.19), frames exposed to refutation (Lakatos, Popper), the struggle kept visible (provenance). Engineering anchors: Cursor (revise the plan artifact, never patch downstream), Cognition (share traces, not conclusions; judges get clean context), Anthropic (durable record; specificity dies at the brief).

## Binding bias safeguards (user-raised; constraints on every mechanism below)

1. **Evidence in, authority out.** Survey output is typed *candidate observations with sources* — never premises. Truth derivation may cite them; the skeptic attacks them exactly like derived truths and may reject any of them.
2. **Enumerate, don't adopt.** Surveyed axes/conventions must be *enumerated* in the coverage map — covered **or excluded with a stated reason**. Visible dissent is a first-class outcome; silent ignorance is the only prohibited state.
3. **Provenance on everything.** Truths carry `groundedIn` (observation ids) vs derived-from-priors; the audit trail shows exactly where the world touched the frame. The frame skeptic is explicitly licensed to attack the survey's framing itself.

## Mechanisms

### M1 — Grounded framing (survey before truths)

- New `src/core/survey.ts`: `surveyLandscape(llm, objective)` → `{ observations: [{ id, kind: "genre-convention" | "topic-axis", statement, source }] }`, schemaName `landscape_survey` (additive), **`webTools: true`** — the sanctioned generation-side web call (CLAUDE.md invariant 1 amended accordingly; everything else in generation stays tool-less). Prompt: two questions only — what does this deliverable's genre professionally contain (as practiced, with sources); what major axes does the world's treatment of this topic span. Statements must be checkable and sourced.
- `deriveTruths(llm, objective, survey?)`: observations rendered as `CANDIDATE OBSERVATIONS (evidence, not premises — reject freely, cite if used)`; `typed_truths` schema gains required `groundedIn: z.array(z.string())` (empty = derived from reasoning). `Truth.groundedIn?: string[]` additive.
- `vet()` (skeptic) receives the survey: attacks WITH external material in hand (Peirce's external permanency) — including attacking survey-grounded truths.
- Ontology stores `survey?: Observation[]` (additive) — the emitted package carries its own grounding.

### M2 — Frame-level skeptic (Lakatos pass)

- New `src/core/frameSkeptic.ts`: runs after decomposition first converges. Input: user objective + survey + **frame summary only** (subtask descriptions + coverageMap dimensions) — deliberately NOT the truths/derivation (Cognition: judges get clean context; Gelman: model-checking is a separate operation). Output: `{ challenges: [{ id, kind: "missing-axis" | "wrong-genre" | "frame-misfit", challenge }] }`, schemaName `frame_challenges` (additive), tool-less.
- Mechanical closure: challenges are fed as one revision round through the existing decomposition refine loop, and the coverage-map judge's candidate rendering lists the challenges with the instruction that each must be **adopted or excluded-with-reason** (the d-breadth criterion text extended to say so). `cov-breadth` unchanged (rows still exactly-one-of). Zero challenges = pass-through (no forced round).
- Frame revision = editing the decomposition artifact (Cursor's rule); downstream stages never compensate.

### M3 — Specificity retention (trace fidelity)

- `src/runtime/renderGuard.ts` gains `retentionGate(deliverable, boardEntries)`: deterministic extraction of specifics from board results — URLs; `$`/`%`/unit-bearing figures; capitalized multi-word names occurring ≥2 across the board — each must appear in the deliverable **or** in a "Verification notes" omission line; failures quote the lost specific. Joins `runGates`.
- `renderContract` adds: `Concrete names, figures, and cited sources from the material are load-bearing — keep them and attribute them. If sources conflict on a name or number, surface the conflict; never silently standardize.`
- `o-grounded` reworded (src/core/rubric.ts): grounding = **assertion with attribution**; fabrication fails; *systematic omission of specifics available in the material also fails*. (Kills the reward-for-evasion bug Haiti proved.)

### M4 — Persistence + discovery flag

- `researchPilot run`: after generation, persist the ontology to `.bench-cache/ontologies/<sampleId>.json`; resume reuses it (kills re-decomposition nondeterminism — the Haiti class). Board persistence deferred (noted).
- `AgentOutput` gains optional `outOfFrame?: string` (agent flags a discovery the frame can't hold); surfaced as `RunResult.discoveries: {agentId, note}[]` (additive) and listed in Verification notes. Full re-planning on discovery: out of scope (the tri-company unsolved problem — minimal visible channel only).

## Pre-registered predictions (recorded before any v4 run)

- **P1:** YouTube task ≥ 0.70 (genre furniture now survey-enumerated; v3: 0.491).
- **P2:** Alignment task ≥ 0.64 (frame skeptic surfaces the safety-literature axis; v3: 0.581).
- **P3:** No task among v3's seven wins regresses vs bare by more than 0.05.
- **P4 (generalization):** on TEN FRESH held-out tasks (new seed, drawn from the remaining 91; bare arm run + graded identically), v4 mean ≥ bare mean. If P1–P3 hit but P4 misses, we publish that the mechanisms overfit the studied tasks.
- Failure of P1 or P2 falsifies the corresponding mechanism; we publish either way.

## Testing

Network-free: survey request shape (webTools true, schemaName, kinds enum); deriveTruths renders observations as evidence-not-premises + groundedIn mapping; vet receives survey; frameSkeptic input contains frame summary but NOT truths (assert absence!); challenge round feeds refine + judge rendering lists challenges; retentionGate extraction (URLs/figures/names ≥2, omission-line escape, quoting); contract line; o-grounded wording; ontology survey/coverageMap/discoveries additive compat; researchPilot ontology persistence + reuse-on-resume (fake fs). Live: smoke on YouTube + alignment first (the falsification targets), then full 10 + held-out 10 (+ bare on held-out), grade, publish.

## Out of scope

Board persistence; full discovery-driven re-planning; any peek at benchmark rubrics (the survey consults the WORLD; querying anything rubric-derived is prohibited); competitor arms.
