# synthesis-contract — Design Spec

**Date:** 2026-07-04
**Status:** Approved by user (post-pilot fix; research-informed — digests in `.superpowers/sdd/research-{harness,skills,prompts}.md`)
**Builds on:** research-pilot loss (merged `41530ed`): bare 0.669 vs principles 0.580; autopsy = verdict bias, role leakage, honesty-tax ordering, synthesis collapse.

## Purpose

Close the runtime's one verification hole: synthesis is the only unjudged, uncontracted step. Give the final deliverable what every agent output already has — a contract fixed before generation, free mechanical gates, and an evidence judge with a refine loop — then rerun the same 10 pilot tasks (principles arm only, bare frozen at 0.669) as a pre-registered single-variable replication.

Research anchors: done-criteria-before-generation and terminal QA gates (Anthropic harness posts, 2026); "code is deterministic; language interpretation isn't" + two-tier output contracts (Skills PDF pp. 5–27); Opus 4.8 calibrates length to the prompt and infers nothing — deliverable shape must be contracted, data-first/instructions-last, per-section budgets beat global targets (2026 prompting docs).

## Changes (all in `src/runtime/` + one additive planner field; self-contained, no new deps, no new schemaNames)

### 1. Deliverable contract — `src/runtime/contract.ts` (new)

```ts
export interface DeliverableContract {
  genre: string;            // e.g. "research report" — from triage (see §2), fallback "comprehensive written response"
  audience: string;         // from triage, fallback "the requester"
  sections: { title: string; budgetWords: number; agentId: string }[];  // one per selected agent, from spec instructions
  totalBudgetWords: number; // sum of section budgets
}
export function buildContract(plan: TriagePlan-ish, specs: AgentSpec[], board: Blackboard): DeliverableContract
export function renderContract(c: DeliverableContract): string   // the instruction block: author-role, genre/audience, outline with per-section budgets, "the answer IS the artifact — no agents/process/blackboard narration; write as the finished document", caveats only in a closing "Verification notes" section, anti-preamble line
```

Budgets are mechanical: per section `clamp(round(0.4 × words of that agent's board result), 150, 1200)`. Sections titled from spec `instructions` first clause (≤60 chars). Deterministic, unit-tested; no LLM call.

### 2. Genre/audience from triage — `src/runtime/planner.ts`

`triage_plan` schema gains required `deliverableGenre: z.string()` and `deliverableAudience: z.string()` (schemaName unchanged; structured-output-safe). Prompt gains one rule: name the genre the user's prompt implies (report/design doc/brief/outline…) and its audience. `TriagePlan` carries them; **code tolerates absence** (old fixtures/fakes → contract falls back) — fixtures updated to include them.

### 3. Render gates — `src/runtime/renderGuard.ts` (new, pure)

```ts
export interface GateResult { pass: boolean; failures: string[] }   // failures quote the offending text
export function roleLeakGate(text: string): GateResult    // /\bsynthesis agent\b/i, /\bagent-s\d+\b/, /\bblackboard\b/i, /\bas the synthesis\b/i — tight list; "AI agents" as topic must pass (tested)
export function substanceGate(text: string, c: DeliverableContract): GateResult  // total words < 25% of totalBudgetWords → fail naming both numbers
export function placeholderGate(text: string): GateResult // TBD/TODO/[placeholder]
export function runGates(text: string, c: DeliverableContract): GateResult
```

Gates are free pre-checks feeding the refine critique (quoted, exact); the judge remains the arbiter. One retry costs a call; a false positive costs one retry, never a block.

### 4. Synthesis judged — `src/runtime/orchestrator.ts`

Replace the single synthesis call with `refine<{answer: string}>` (maxIterations 2):
- **Generate:** restructured call — prompt = tagged `<documents>` (one per board entry, titled by subtask) FIRST, then `<instructions>`: user prompt + `renderContract(...)` LAST (data-first/instructions-last). System = author-role only. Unverified-agent caution list moves INTO the instructions with "reflect these only in the closing Verification notes section." Feedback (gate failures + judge critique) appended on retries.
- **Judge:** existing `judge()` against `ontology.outputRubric` (FULL rubric — whole-objective criteria finally have a legitimate home) **plus** mechanical contract criteria: `c-contract-genre`, `c-contract-sections` (each section outline item addressed), `c-contract-clean` (no process narration; caveats confined to the closing section). Render gates run before each judge call; failures convert to synthetic FAIL verdicts appended to the critique (free, deterministic).
- **Non-convergence:** ship the best candidate, push literal `"synthesis"` onto `RunResult.unverified` (additive marker), and the escape hatch/`[caution]` path stays untouched. Never silently blessed.

Cost: +1 to +5 calls per run (gates are free; judge 1–2; regen 0–2).

## Pilot rerun protocol (pre-registered)

- Same manifest (seed 20260703), same grader, same formula. Bare arm untouched: **0.669 stands**.
- v1 principles artifacts move to `benchmarks/research-pilot/v1/` (responses + grading + run log — the loss stays public; the article needs it). Fresh `responses/principles/` + `grading/principles/` for v2.
- Smoke first on the worst offender (`6053ca`, v1 = 0.458 with role-leak opener) — read by eye before the other nine run.
- README updated with a v1→v2 before/after table and honest framing either way; decision rule: v2 mean > bare ⇒ autopsy validated; v2 ≤ v1-ish ⇒ autopsy falsified, say so.
- Grading cost ≈ $4.50 of the user's Gemini credits; generation on subscription.

## Testing (network-free)

contract.ts: budget math (clamps both ends), section titling, fallbacks without genre fields; renderContract contains genre/outline/budgets/no-narration/appendix/anti-preamble lines. renderGuard: each gate positive + negative ("AI agents are..." passes roleLeakGate; a 6-word answer fails substanceGate against a 2000-word contract naming 25%). planner: additive fields parsed; absent fields tolerated. orchestrator: scripted-fake tests — documents-before-instructions ordering in the synthesis prompt; gate failure produces a retry whose prompt quotes the offending phrase; judge fail → second iteration; non-convergence → `unverified` contains `"synthesis"`; converged path unchanged shape. Existing scripted fixtures gain the new triage fields + synthesis-judge verdicts.

## Out of scope

Skills-shaped agent instruction blocks; fragility-tiered outputHints; typed handoff briefings beyond the contract; effort/max-token gateway knobs; competitor arms. (Backlog in the research digests.)
