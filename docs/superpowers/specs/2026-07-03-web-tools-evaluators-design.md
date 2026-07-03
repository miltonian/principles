# web-tools-evaluators — Design Spec

**Date:** 2026-07-03
**Status:** Approved by user (design conversation; standing authorization covers spec→build)
**Builds on:** ci-evidence-judge (merged as `196eeb9`)

## Purpose

Let generated evaluator agents use web search/fetch where — and only where — the decomposition proves they need it. Gating model (user-approved): **model proposes, judge verifies** — subtasks declare `needsWeb` with a justification; a mechanical check and a rubric criterion reject unjustified requests inside the existing refine loop; the runtime honors the surviving flags per agent. Build 3 of the three-build sequence.

## Contract changes (all additive; old ontologies remain valid and tool-less)

### `src/llm/gateway.ts` — `LlmRequest`

```ts
export interface LlmRequest<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  webTools?: boolean;   // NEW: when true, the backing gateway may enable web search/fetch for THIS call only
}
```

### `src/llm/claudeGateway.ts`

- `const WEB_MAX_TURNS = 12;` (tool loops consume turns; existing `MAX_TURNS = 4` unchanged for tool-less calls).
- When `req.webTools`: `tools: ["WebSearch", "WebFetch"]`, `allowedTools: ["WebSearch", "WebFetch"]`, `maxTurns: WEB_MAX_TURNS`. Otherwise byte-identical current behavior (`tools: []`, `allowedTools: []`, `maxTurns: MAX_TURNS`).
- Never any other tool. Retry/`$schema`/structured-output behavior unchanged and shared by both paths.
- Verify the literal tool names against the installed SDK's `.d.ts` at implementation time (compiler over plan prose, as before); adjust only the two string literals if the SDK names differ.

### `src/shared/types.ts`

- `Subtask` gains `needsWeb?: boolean;` and `webJustification?: string;`
- `AgentSpec` gains `webTools?: boolean;`
(Additive optional fields only; `src/shared` stays self-contained; no new deps → no `emit.ts` change.)

## Generation side

### `src/core/decompose.ts`

- `DecompositionSchema` items gain `needsWeb: z.boolean()` and `webJustification: z.string()` (required in the schema — structured outputs dislike optionals; empty string = "none"). Mapping: `needsWeb` copied; `webJustification` copied trimmed.
- Prompt additions: subtasks that require fetching or searching external material set `needsWeb: true` with a CONCRETE justification naming what external material and why the prompt's own content can't suffice; all others `needsWeb: false` with empty justification. Feedback path unchanged.

### `src/core/coverage.ts` — mechanical check

- New pure check `unjustifiedWeb(subtasks): string[]` — ids where `needsWeb === true` and `(webJustification ?? "").trim() === ""`.
- `coverageCritique` gains verdict `cov-web-justified` (same pattern as the other five; runs free, before any LLM judge).

### `src/core/rubric.ts`

- `decompositionRubric` gains one generic criterion appended after `d-complete`:
  `{ id: "d-web", source: "generic", description: "Web access (needsWeb) is requested only where the subtask genuinely requires external material, and each request's justification is concrete — not speculative convenience." }`
- `outputRubric` unchanged.

### `src/core/specs.ts`

- `AgentSpec.webTools` = `subtask.needsWeb === true` (spread-conditional so the key is absent when false — keeps ontology.json clean).
- Spec-generation prompt: when the subtask has `needsWeb`, tell the spec writer the agent will have web search/fetch and instructions should direct what to retrieve and to cite URLs.

## Runtime side

### `src/runtime/agent.ts`

- `runAgent` passes `webTools: spec.webTools` in its `llm({...})` call (undefined for non-flagged — no behavior change).
- System prompt: when `spec.webTools`, append line: `You may use web search and web fetch for this subtask. Cite the URLs you used in your notes.`

### Unchanged

Planner, orchestrator, judge, synthesis, blackboard — all remain tool-less calls. `rubricCompiler`/`diffJudge` ignore the new subtask fields (completeness criteria descriptions unchanged).

## Invariants (CLAUDE.md updates in-scope)

- Invariant #1 wording: gateway calls are tool-less **except** per-call web tools (`WebSearch`/`WebFetch` only) granted via `LlmRequest.webTools`, which only the runtime's flagged evaluator agents set.
- Invariant #5 addition: web access must be justified at decomposition and verified by `cov-web-justified` + `d-web`.
- New CLAUDE.md note under Commands or Invariants: generation pipeline itself (truths/skeptic/decompose/judge/specs/rubrics) never sets `webTools`.

## Error handling

- Judge/refine handles overeager web requests (revision or escalation — existing machinery; no new paths).
- Gateway web calls failing (fetch errors, etc.) surface exactly like any model-call failure: gateway retry then loud error; runtime's per-agent refine/unverified flow unchanged.

## Testing

Network-free: gateway option-mapping capture tests (webTools true/false → tools/allowedTools/maxTurns), decompose schema mapping (needsWeb/justification), `unjustifiedWeb` + `cov-web-justified`, `d-web` presence/order in decompositionRubric, spec propagation (webTools key present only when true), runAgent request capture (webTools passthrough + system-prompt line). Full-pipeline scripted test updated where fixtures gain the new required schema fields.

Live gate: regenerate the study evaluator with the goal "evaluate whether a claim backed by data is based on a sufficiently rigorous study, fetching the study itself when a link or citation is provided" — verify at least one extraction subtask self-proposes web WITH concrete justification and survives the judge; then run the package in-frame with a real, public paper URL and verify the answer's notes cite fetched URLs; run an out-of-frame haiku check to confirm the escape hatch still works; confirm non-flagged agents' transcripts contain no tool use.

## Out of scope

Any tools beyond WebSearch/WebFetch; web for the generation pipeline; user-facing enable/disable flags; per-domain allowlists; caching fetched content across agents (blackboard notes are the sharing mechanism).
