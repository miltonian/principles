# grounded-framing Implementation Plan (v4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Survey-grounded truth derivation, a frame-level skeptic, a specificity-retention gate, and generation persistence — per `docs/superpowers/specs/2026-07-04-grounded-framing-design.md` (bias safeguards are BINDING; predictions P1–P4 pre-registered there).

**Architecture:** `src/core/survey.ts` (new, the one sanctioned generation-side web call) feeding `truths.ts`/`skeptic.ts`; `src/core/frameSkeptic.ts` (new) closing through the existing decomposition refine loop in `foundations.ts`; `renderGuard.ts` gains `retentionGate`; `rubric.ts` rewords `o-grounded`; `researchPilot.ts` persists/reuses ontologies; `agent.ts`/`orchestrator.ts` gain the `outOfFrame` discovery flag.

**Tech Stack:** existing (CommonJS TS strict, zod 3, vitest). New schemaNames `landscape_survey`, `frame_challenges` (additive only — never touch the load-bearing list).

## Global Constraints

- Bias safeguards from the spec are binding: observations rendered as `CANDIDATE OBSERVATIONS (evidence, not premises — reject freely, cite if used)`; coverage map must enumerate-or-exclude surveyed axes; `Truth.groundedIn` provenance everywhere.
- The frame skeptic's input MUST NOT contain the truths/derivation (test asserts absence).
- All new type fields additive/optional on shared types; old ontologies load unchanged. Copied-dir hygiene (invariant 3): no new imports in `src/runtime`/`src/shared`/`src/llm` beyond intra-dir; `survey.ts` lives in `src/core` (NOT copied).
- CLAUDE.md invariant 1 amended in G1: the survey step is the sanctioned generation-side `webTools` call.
- All zod additions structured-output-safe (required fields, closed objects, enums OK).
- Fixture drill awareness: pipeline/foundations/rubricCompiler scripted fakes need `landscape_survey` + `frame_challenges` responses and `groundedIn` fields — G1/G2 handle their own fixture fallout.
- Branch `synthesis-contract` (the saga ships as one PR). `yarn build && yarn test` green at every commit (baseline 163). NEVER run `yarn build` while a pilot run is live (none is right now — dist rebuilds are safe until G5's runs start).

---

### Task G1: Survey + grounded truths + provenance

**Files:** Create `src/core/survey.ts`; modify `src/core/truths.ts`, `src/core/skeptic.ts` (read it first — vet() signature), `src/core/foundations.ts`, `src/core/pipeline.ts`, `src/shared/types.ts` (additive `Truth.groundedIn?: string[]`, `Ontology.survey?: Observation[]`), `CLAUDE.md` (invariant 1 sentence). Tests: `tests/core/survey.test.ts` (new), append truths/skeptic/foundations tests; update scripted fixtures.

**Interfaces (Produces):**
```typescript
// src/core/survey.ts
export interface Observation { id: string; kind: "genre-convention" | "topic-axis"; statement: string; source: string; }
export async function surveyLandscape(llm: Llm, objective: string): Promise<Observation[]>;
// schemaName "landscape_survey", webTools: true, schema { observations: [{ kind: enum, statement, source }] }; ids assigned in code obs1..obsN (mirror deriveTruths id pattern).
```
- `deriveTruths(llm, objective, survey?: Observation[])` — prompt gains, when survey present, a `## CANDIDATE OBSERVATIONS (evidence, not premises — reject freely, cite if used)` block listing `obsN [kind] statement (source)`; `typed_truths` zod schema gains required `groundedIn: z.array(z.string())`; mapping copies it (defensive `?? []`). System prompt adds one rule: `groundedIn lists the observation ids a truth rests on; empty for truths derived by reasoning alone.`
- `vet(...)` receives `survey?` and renders it in the skeptic's prompt under `## External observations (attack the truths WITH these in hand — and attack the observations themselves where they are weak)`.
- `deriveFoundations`: `const survey = await surveyLandscape(llm, objective)` first; thread into deriveTruths + vet; return survey; `pipeline.ts` stores it on the ontology.
- Tests: survey request shape (webTools true, enum kinds, id assignment); truths prompt contains the evidence-not-premises header + groundedIn mapping; skeptic prompt contains observations; foundations threads survey (scripted fake gains `landscape_survey` response; all pipeline-family fixtures updated). CLAUDE.md wording test not needed (docs).
- Commit: `feat: survey-grounded truth derivation with provenance (evidence in, authority out)`

### Task G2: Frame-level skeptic

**Files:** Create `src/core/frameSkeptic.ts`; modify `src/core/foundations.ts` (challenge round + judge rendering), `src/core/rubric.ts` (d-breadth text extension). Tests: new `tests/core/frameSkeptic.test.ts`, append foundations tests; fixtures gain `frame_challenges` responses.

**Interfaces:**
```typescript
export interface FrameChallenge { id: string; kind: "missing-axis" | "wrong-genre" | "frame-misfit"; challenge: string; }
export async function challengeFrame(llm: Llm, objective: string, survey: Observation[], frameSummary: string): Promise<FrameChallenge[]>;
// schemaName "frame_challenges", tool-less; frameSummary = subtask descriptions + coverageMap dimensions ONLY (caller builds it; truths NEVER included)
```
- foundations.ts after the decomposition refine converges: build frameSummary (subtask `- sN: description` lines + `- dimension: X (handledBy/excluded)` lines); call challengeFrame; if challenges.length > 0 → run EXACTLY ONE additional decomposition revision via the existing feedback path, where the feedback critique verdicts are synthetic FAILs `{criterionId: "frame-<id>", pass: false, evidence: challenge}` (reuse the RefineFeedback shape — read refine.ts; construct the feedback object directly rather than re-entering refine()); then re-run coverage + judge once; the judge's candidate rendering appends `Frame challenges raised (each must be adopted or excluded-with-reason): ...`. Non-convergence surfaces exactly like today (status escalated/exhausted propagates).
- d-breadth description extended with: `; frame challenges raised by the external skeptic are adopted or explicitly excluded with reasons — never ignored`.
- Tests: challengeFrame prompt contains frameSummary + survey but asserts `.not.toContain` a truth statement passed as bait; zero challenges → no extra decomposition call (call-count assertion); with challenges → one revision whose prompt quotes the challenge text; judge candidate lists challenges.
- Commit: `feat: frame-level skeptic — Lakatos pass over the chosen frame`

### Task G3: Retention gate + o-grounded fix

**Files:** modify `src/runtime/renderGuard.ts` (add `retentionGate` + join `runGates` — note runGates signature grows a boardEntries param; update orchestrator call), `src/runtime/contract.ts` (renderContract line), `src/core/rubric.ts` (o-grounded rewording). Tests: renderGuard/contract/rubric/orchestrator appends.

- `retentionGate(deliverable: string, entries: BlackboardEntry[]): GateResult` — extract from entries[].result: URLs (`/https?:\/\/[^\s)>"']+/g`); figures (`/\$[\d,.]+[MBk]?|\d+(?:\.\d+)?%|\b\d[\d,]*\s?(?:km|kg|GW|MW|USD|people|deaths|billion|million)\b/g`); names = capitalized 2+-word sequences (`/\b[A-Z][a-zA-Z'’-]+(?:\s[A-Z][a-zA-Z'’-]+)+\b/g`) counted across ALL entries, kept if count ≥ 2 and not a section-heading commonword pair (maintain a small stoplist: e.g. starts with common sentence-openers "The|This|In|As|Executive Summary" — keep simple + tested). Each extracted specific must appear verbatim in the deliverable OR the deliverable's Verification-notes section must contain it (single containment check — omission-line escape hatch). Failures: `Retention: "<specific>" (from <agentId>) missing from deliverable and not listed as an omission`. Cap reported failures at 10 (quota note).
- `runGates(text, contract, entries)` adds the gate; orchestrator passes `board.all()`.
- renderContract adds the load-bearing-specifics line from the spec verbatim.
- o-grounded new text: `Claims are grounded via attribution to sources or prior agent material; nothing is fabricated — and specifics available in the material (names, figures, sources) are asserted with attribution rather than systematically omitted or hedged away.`
- Tests: URL/figure/name extraction cases; ≥2 threshold; omission-line escape works; stoplist keeps "Executive Summary" out; deliverable containing all specifics passes; orchestrator wiring (existing fixtures updated — scripted synthesis answers must now retain fixture-board specifics or list omissions; adjust the fixtures' agent results to avoid tripping: simplest is agent results without qualifying specifics, PLUS one new test where a board URL is dropped → gate failure quoted in retry).
- Commit: `feat: specificity retention gate — receipts survive the last mile; o-grounded rewards attribution not omission`

### Task G4: Persistence + discovery flag

**Files:** modify `src/scripts/researchPilot.ts` (persist/reuse ontology per task), `src/runtime/agent.ts` (`outOfFrame` optional in schema+output), `src/runtime/orchestrator.ts` (`RunResult.discoveries`), `src/bench/researchArms.ts` (thread runners persistence hooks — read how runPrinciplesArm calls generate/run; persistence belongs in the CLI's deps layer: `deps.readFile/writeFile` on `.bench-cache/ontologies/<sampleId>.json`, generate skipped when present — inject via the existing `runners` seam by wrapping generate in the CLI, NOT by changing researchArms). Tests: researchPilot append (persist on first run — file written; on resume with file present → generate NOT called, run called with the persisted ontology), agent/orchestrator appends (outOfFrame → discoveries; absent → []).

- AgentOutputSchema gains `outOfFrame: z.string().optional()`; runAgent returns it; orchestrator collects `{agentId, note}` into `discoveries` (additive on RunResult) and synthesis instructions mention discoveries belong in Verification notes.
- Commit: `feat: ontology persistence across resumes + out-of-frame discovery channel`

### Task G5: Live — smoke, full 10, held-out 10, grade, publish (controller-run)

- [ ] Preserve v3 artifacts (`git mv` → `v3-*`), commit. Rebuild dist (no live runs at that moment).
- [ ] Smoke: run YouTube (60543d) and alignment (605440) tasks first — read outputs by eye against P1/P2 mechanics (furniture present? safety axes enumerated or visibly excluded?) before burning the rest.
- [ ] Full 10 at `--concurrency 3`; then held-out: `fetch` a second manifest (seed 20260705, excluding the original 10 ids — needs a small `--exclude-manifest` or seed-filter tweak; implement minimally with a review) + bare arm + v4 arm on held-out; grade everything (~$15–18); scoreboard with P1–P4 verdicts verbatim.
- [ ] README: the four-version arc table + prediction scorecard + held-out generalization verdict. Final whole-branch review (fable, artifact-integrity + overfitting-audit emphasis), fixes, PR, merge.

## Self-Review Notes

- Spec coverage: M1→G1, M2→G2, M3→G3, M4→G4, predictions/held-out→G5. Safeguards: evidence-not-premises header (G1 test), enumerate-or-exclude via d-breadth extension (G2), provenance groundedIn (G1).
- Placeholder scan: clean; heavy patterns all reference in-repo templates (id assignment, refine feedback shape, gate style, fixture drill).
- Type consistency: Observation G1→G2 signature; FrameChallenge ids `frame-<id>` in synthetic verdicts; runGates arity change handled in G3 with orchestrator update; RunResult.discoveries additive.
- Judgment calls: ONE challenge revision round (cost bound, matches refine escalation philosophy); retention extraction deliberately conservative-with-stoplist (false-positive budget = one retry, same as role-leak gate); ontology persistence at CLI layer to keep bench arms pure.
