# synthesis-contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contract, gate, and judge the runtime's synthesis step (the pilot's failure point), then rerun the 10-task pilot principles arm as a pre-registered replication, per `docs/superpowers/specs/2026-07-04-synthesis-contract-design.md`.

**Architecture:** Two new pure modules in `src/runtime/` (`contract.ts`, `renderGuard.ts`), an additive triage field pair in `planner.ts`, and an orchestrator rewrite wrapping synthesis in the existing `refine()`+`judge()` with data-first/instructions-last prompting.

**Tech Stack:** Existing repo stack. `src/runtime` is a verbatim-copied dir: no new imports beyond zod/shared/llm already in use; no new deps; no new schemaNames.

## Global Constraints

- `src/runtime/` stays self-contained (invariant 3). No changes to `src/core/`, `src/llm/`, `src/shared/` except NONE are needed.
- `triage_plan` schemaName unchanged; its zod schema gains two REQUIRED string fields (structured-output-safe); consuming code tolerates their absence (old fakes/fixtures) via fallbacks.
- Gates feed critiques; they never hard-block a run. Judge + refine (maxIterations 2) arbitrate. Non-convergence pushes the literal string `"synthesis"` onto `RunResult.unverified`.
- All budgets/scans deterministic and unit-tested. No Math.random, no Date.
- Branch `synthesis-contract`. `yarn build && yarn test` green at every commit (baseline: 125).

---

### Task S1: Deliverable contract + triage genre fields

**Files:**
- Create: `src/runtime/contract.ts`
- Modify: `src/runtime/planner.ts`
- Test: `tests/runtime/contract.test.ts` (new), `tests/runtime/planner.test.ts` (append)

**Interfaces (Produces):**

```typescript
// src/runtime/contract.ts
import { AgentSpec } from "../shared/types";
import { BlackboardEntry } from "./blackboard";

export interface DeliverableContract {
  genre: string;
  audience: string;
  sections: { title: string; budgetWords: number; agentId: string }[];
  totalBudgetWords: number;
}
export function sectionTitle(instructions: string): string;      // first sentence/clause, cut at first "." or ";" then hard-cap 60 chars
export function sectionBudget(resultWords: number): number;      // clamp(round(0.4 * resultWords), 150, 1200)
export function buildContract(
  genre: string | undefined,
  audience: string | undefined,
  specs: AgentSpec[],                                            // the SELECTED agents, ontology order
  entries: BlackboardEntry[],                                    // board state after all levels
): DeliverableContract;                                          // genre fallback "comprehensive written response"; audience fallback "the requester"; sections only for specs with a board entry
export function renderContract(c: DeliverableContract): string;  // instruction block, see Step 3 for the exact text
```

`PlanResult` (planner.ts) gains `deliverableGenre?: string; deliverableAudience?: string;`.

- [ ] **Step 1: Failing tests** (`tests/runtime/contract.test.ts`):

```typescript
import { describe, expect, it } from "vitest";
import { buildContract, renderContract, sectionBudget, sectionTitle } from "../../src/runtime/contract";
import type { AgentSpec } from "../../src/shared/types";

const spec = (id: string, instructions: string): AgentSpec =>
  ({ id, name: id, subtaskId: id.replace("agent-", ""), instructions, servesTruths: ["t1"], dependsOn: [], outputHint: "text" });
const entry = (agentId: string, words: number) =>
  ({ agentId, subtask: "s", notes: "", result: Array(words).fill("w").join(" ") });

describe("sectionBudget", () => {
  it("is 40% of source words, clamped to [150, 1200]", () => {
    expect(sectionBudget(1000)).toBe(400);
    expect(sectionBudget(100)).toBe(150);
    expect(sectionBudget(10000)).toBe(1200);
  });
});

describe("sectionTitle", () => {
  it("takes the first clause and caps at 60 chars", () => {
    expect(sectionTitle("Analyze the market. Then produce tables.")).toBe("Analyze the market");
    expect(sectionTitle("x".repeat(80))).toHaveLength(60);
  });
});

describe("buildContract", () => {
  it("builds sections only for agents with board entries, in spec order, with fallbacks", () => {
    const c = buildContract(undefined, undefined, [spec("agent-s1", "Research A."), spec("agent-s2", "Research B.")], [entry("agent-s1", 1000)]);
    expect(c.genre).toBe("comprehensive written response");
    expect(c.audience).toBe("the requester");
    expect(c.sections).toEqual([{ title: "Research A", budgetWords: 400, agentId: "agent-s1" }]);
    expect(c.totalBudgetWords).toBe(400);
  });
  it("uses provided genre/audience", () => {
    const c = buildContract("research report", "engineers", [spec("agent-s1", "Research A.")], [entry("agent-s1", 500)]);
    expect(c.genre).toBe("research report");
    expect(c.audience).toBe("engineers");
  });
});

describe("renderContract", () => {
  const c = buildContract("research report", "engineers", [spec("agent-s1", "Research A.")], [entry("agent-s1", 1000)]);
  const text = renderContract(c);
  it("carries genre, audience, outline with budgets, and the discipline lines", () => {
    expect(text).toContain("research report");
    expect(text).toContain("engineers");
    expect(text).toContain("Research A (~400 words)");
    expect(text).toContain("The answer IS the finished document");
    expect(text).toContain("Verification notes");
    expect(text).toContain("without preamble");
    expect(text).not.toMatch(/blackboard/i);
  });
});
```

Append to `tests/runtime/planner.test.ts` (mirror its existing fake style):

```typescript
  it("passes deliverable genre/audience through and tolerates their absence", async () => {
    const withFields = await plan(fakePlanLlm({ fits: true, reason: "r", selectedAgentIds: ["agent-s1"], deliverableGenre: "design doc", deliverableAudience: "ML engineers" }), ontology, "p");
    expect(withFields.deliverableGenre).toBe("design doc");
    expect(withFields.deliverableAudience).toBe("ML engineers");
    const without = await plan(fakePlanLlm({ fits: true, reason: "r", selectedAgentIds: ["agent-s1"] }), ontology, "p");
    expect(without.deliverableGenre).toBeUndefined();
  });
```

(Adapt `fakePlanLlm`/`ontology` names to that file's existing helpers; add a helper if none exists.)

- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement.** `contract.ts` exactly per interfaces; `renderContract` returns:

```typescript
export function renderContract(c: DeliverableContract): string {
  return [
    `You are the author of the finished deliverable: a ${c.genre} for ${c.audience}.`,
    `The answer IS the finished document — a standalone artifact the reader receives cold.`,
    `Never mention agents, subtasks, internal workspaces, or how the work was produced.`,
    `Cover this outline (budgets are minimums to take seriously, not caps):`,
    ...c.sections.map((s) => `- ${s.title} (~${s.budgetWords} words)`),
    `Target at least ${c.totalBudgetWords} words of substantive content overall.`,
    `Any verification caveats or uncertainty belong ONLY in a short closing "Verification notes" section — content first.`,
    `Respond directly without preamble. Do not start with "Here is" or describe what you are about to do.`,
  ].join("\n");
}
```

`planner.ts`: `PlanSchema` gains `deliverableGenre: z.string()` and `deliverableAudience: z.string()`; system gains one rule line: `Name the deliverable genre the prompt implies (research report, design document, brief, outline...) and its audience.`; `PlanResult` gains the two optional fields; return `{ ..., deliverableGenre: (raw as { deliverableGenre?: string }).deliverableGenre, deliverableAudience: ... }` — read defensively so fakes without the fields stay valid.
- [ ] **Step 4: GREEN + full suite** (update any triage_plan fixtures that zod-validate — none should, fakes bypass zod; update the pipeline/orchestrator scripted fakes to INCLUDE the two new fields anyway: fixtures model reality).
- [ ] **Step 5: Commit** — `git commit -m "feat: deliverable contract builder + triage genre/audience fields"`

---

### Task S2: Render gates

**Files:**
- Create: `src/runtime/renderGuard.ts`
- Test: `tests/runtime/renderGuard.test.ts`

**Interfaces (Produces):** per spec §3 (`GateResult`, `roleLeakGate`, `substanceGate`, `placeholderGate`, `runGates`).

- [ ] **Step 1: Failing tests:**

```typescript
import { describe, expect, it } from "vitest";
import { placeholderGate, roleLeakGate, runGates, substanceGate } from "../../src/runtime/renderGuard";
import type { DeliverableContract } from "../../src/runtime/contract";

const contract: DeliverableContract = { genre: "g", audience: "a", sections: [], totalBudgetWords: 2000 };

describe("roleLeakGate", () => {
  it("fails on internal vocabulary, quoting the offense", () => {
    const r = roleLeakGate("I'm the synthesis agent; the blackboard already contains a design.");
    expect(r.pass).toBe(false);
    expect(r.failures.join(" ")).toContain("synthesis agent");
    expect(roleLeakGate("Work assigned to agent-s4 was incomplete.").pass).toBe(false);
  });
  it("passes legitimate topical uses of 'agent'", () => {
    expect(roleLeakGate("AI agents adopting MCP grew rapidly; multi-agent systems benefit.").pass).toBe(true);
  });
});

describe("substanceGate", () => {
  it("fails under 25% of budget naming both numbers", () => {
    const r = substanceGate("only ten words of content here for the whole report", contract);
    expect(r.pass).toBe(false);
    expect(r.failures[0]).toContain("2000");
    expect(substanceGate(Array(600).fill("w").join(" "), contract).pass).toBe(true);
  });
});

describe("placeholderGate", () => {
  it("fails on TBD/TODO/[placeholder]", () => {
    expect(placeholderGate("Cost: TBD").pass).toBe(false);
    expect(placeholderGate("A todo-list app design").pass).toBe(true); // word-boundary + case rules
  });
});

describe("runGates", () => {
  it("aggregates failures across gates", () => {
    const r = runGates("I'm the synthesis agent. TODO: finish.", contract);
    expect(r.pass).toBe(false);
    expect(r.failures.length).toBeGreaterThanOrEqual(3); // leak + substance + placeholder
  });
});
```

- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement.** Patterns: role leak = `[/\bsynthesis agent\b/i, /\bagent-s\d+\b/, /\bblackboard\b/i, /\bas the synthesis\b/i]`, failure message quotes the matched text ±40 chars. Substance: word count `< 0.25 * totalBudgetWords` (skip when totalBudgetWords is 0) → message `"deliverable is N words against a M-word contract (floor 25%)"`. Placeholder: `[/\bTBD\b/, /\bTODO\b/, /\[placeholder\]/i]` (case-sensitive TBD/TODO — "todo-list" passes via boundary+case). `runGates` concatenates.
- [ ] **Step 4: GREEN + full suite.**
- [ ] **Step 5: Commit** — `git commit -m "feat: mechanical render gates for the deliverable"`

---

### Task S3: Orchestrator — synthesis contracted, gated, judged

**Files:**
- Modify: `src/runtime/orchestrator.ts`
- Test: `tests/runtime/orchestrator.test.ts` (append + fixture updates)

**Interfaces:**
- Consumes: S1 (`buildContract`, `renderContract`), S2 (`runGates`), existing `refine` (`src/shared/refine.ts`: `refine<T>(generate: (feedback?: Feedback<T>) => Promise<T>, judgeFn: (candidate: T) => Promise<Critique>, opts)`) — READ refine.ts first and match its real signature; the compiler wins over this plan.
- Produces: unchanged `RunResult` shape; `unverified` may additionally contain `"synthesis"`.

- [ ] **Step 1: Failing tests** (append to `tests/runtime/orchestrator.test.ts`; extend the scripted fakes so `triage_plan` returns the two new fields and `rubric_verdicts` keeps passing agent judges):

```typescript
  it("synthesis prompt is data-first/instructions-last with the contract, and converged runs stay clean", async () => {
    const prompts: Record<string, string[]> = { synthesis: [], rubric_verdicts: [] };
    // scripted fake: triage → agent_output → agent judge PASS → synthesis → synthesis judge PASS
    // capture req.prompt per schemaName; synthesis judge returns all-pass for outputRubric criteria.
    const result = await runOntology(scriptedContractLlm(prompts), ontology, "Write me a report on X");
    const sp = prompts.synthesis[0];
    expect(sp.indexOf("<documents>")).toBeGreaterThanOrEqual(0);
    expect(sp.indexOf("<instructions>")).toBeGreaterThan(sp.indexOf("</documents>"));
    expect(sp).toContain("The answer IS the finished document");
    expect(result.unverified).not.toContain("synthesis");
  });

  it("gate failures are quoted into the synthesis retry and non-convergence flags 'synthesis'", async () => {
    // scripted fake: synthesis ALWAYS returns "I'm the synthesis agent. Done." (fails roleLeakGate + substanceGate);
    // synthesis judge returns all-pass (so ONLY the gates force iteration) — after maxIterations the run ships flagged.
    const prompts: string[] = [];
    const result = await runOntology(scriptedLeakyLlm(prompts), ontology, "Write me a report on X");
    expect(prompts.length).toBeGreaterThanOrEqual(2);                      // initial + at least one retry
    expect(prompts[1]).toContain("synthesis agent");                       // quoted offense fed back
    expect(result.unverified).toContain("synthesis");
    expect(result.answer).toContain("I'm the synthesis agent");            // best candidate still shipped, flagged
  });
```

Write the two scripted fakes fully in the file, following the existing `scriptedLlm` pattern (dispatch on schemaName, record prompts). The synthesis-judge fake responds to `rubric_verdicts` requests whose prompt contains the contract criteria ids (`c-contract-genre` etc.) — key the dispatch on prompt content the way the foundations test keys on schemaName+content.

- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement in `orchestrator.ts`:**

```typescript
// after the levels loop:
const contract = buildContract(triage.deliverableGenre, triage.deliverableAudience,
  triage.agents, board.entries());          // add a read accessor on Blackboard if none exists — check blackboard.ts; entries() may already exist as .entries or expose board's array via render-independent getter. Compiler wins; add a minimal entries() if absent.

const contractCriteria: Criterion[] = [
  { id: "c-contract-genre", source: "generic", description: `The deliverable is a ${contract.genre} for ${contract.audience}, written as a standalone finished document.` },
  { id: "c-contract-sections", source: "generic", description: `The deliverable substantively covers every outline item: ${contract.sections.map((s) => s.title).join("; ")}.` },
  { id: "c-contract-clean", source: "generic", description: `No internal-process narration (agents, workspaces, roles); verification caveats appear only in a short closing "Verification notes" section.` },
];

const synthesisOutcome = await refine<{ answer: string }>(
  (feedback) =>
    llm({
      system: `You are the author of the final deliverable.`,
      prompt: [
        `<documents>`,
        ...board.entries().map((e) => [`<document title="${e.subtask.slice(0, 80)}">`, e.result, e.notes ? `Notes: ${e.notes}` : ``, `</document>`].join("\n")),
        `</documents>`,
        ``,
        `<instructions>`,
        `## Request`,
        userPrompt,
        ``,
        renderContract(contract),
        ...(unverified.length > 0
          ? [``, `Contributions from ${unverified.join(", ")} did not pass verification; reflect that ONLY inside the closing "Verification notes" section.`]
          : []),
        ...(feedback
          ? [``, `## Your previous draft was rejected — fix exactly this`, feedback.critique.verdicts.filter((v) => !v.pass).map((v) => `${v.criterionId}: ${v.evidence}`).join("\n")]
          : []),
        `</instructions>`,
      ].join("\n"),
      schema: z.object({ answer: z.string() }),
      schemaName: "synthesis",
    }),
  async (candidate) => {
    const gates = runGates(candidate.answer, contract);
    const critique = await judge(llm, {
      rubric: [...ontology.outputRubric, ...contractCriteria],
      candidate: candidate.answer,
      context: `Final deliverable for: ${ontology.objective}. User request: ${userPrompt}`,
    });
    if (!gates.pass) {
      critique.verdicts.push(...gates.failures.map((f, i) => ({ criterionId: `gate-${i}`, pass: false, evidence: f })));
    }
    return critique;
  },
  { maxIterations: 2 }
);
const synthesis = synthesisOutcome.result;
if (synthesisOutcome.status !== "converged") unverified.push("synthesis");
```

Keep the escape-hatch path untouched. Adjust to `refine`'s real Feedback/Critique types (read `src/shared/refine.ts` + `src/shared/judge.ts` first — the compiler wins). Remove the old synthesis block. Note the judge's mechanical rules apply to the combined rubric: a critique must address the contract criteria or they fail automatically — that's intended.
- [ ] **Step 4: GREEN + full suite** (existing orchestrator tests need their scripted fakes extended with a synthesis-judge pass response and the new triage fields; the always-failing-rubric test now also exercises the synthesis judge — give its fake a passing synthesis-judge response keyed on prompt content so the test's intent — agent-level failure — stays isolated).
- [ ] **Step 5: Commit** — `git commit -m "feat: synthesis contracted, gated, and judged — closes the runtime's last unverified step"`

---

### Task S4: Live — smoke on the worst offender, full v2 rerun, regrade, publish (controller-run)

- [ ] **Step 1:** Move v1 aside: `git mv benchmarks/research-pilot/responses/principles benchmarks/research-pilot/v1-responses-principles && git mv benchmarks/research-pilot/grading/principles benchmarks/research-pilot/v1-grading-principles && git mv benchmarks/research-pilot/run-log-principles.jsonl benchmarks/research-pilot/v1-run-log-principles.jsonl`; commit "chore: preserve pilot v1 principles artifacts".
- [ ] **Step 2:** Smoke `6053ca` only (`yarn research-pilot run --arm principles --limit 1 --yes` won't target a specific id — run with `--limit 1` after temporarily... NO: run the full arm; resumability makes order manifest-driven. Instead smoke = watch the FIRST completed task, read it by eye (role leak? genre? length?), and kill/fix if broken before letting the rest burn. Launcher identical to v1's with watchdog envs + 90-min windows, relaunch on reap).
- [ ] **Step 3:** Full arm to 10/10; then grade v2: `bash .superpowers/sdd/run-full-grade.sh` (bare cached → skipped automatically; principles dir is fresh).
- [ ] **Step 4:** Update `benchmarks/research-pilot/README.md`: v1→v2 per-task table, new mean vs frozen bare 0.669, what changed (one paragraph, spec-linked), honest verdict per the pre-registered rule. Commit all artifacts.
- [ ] **Step 5:** Final whole-branch review (fable; artifact-integrity emphasis like last time), fixes, PR, merge per standing authorization.

---

## Self-Review Notes

- **Spec coverage:** contract+fallbacks+triage fields (S1), gates (S2), restructured judged synthesis + unverified marker (S3), pre-registered rerun + honest publication (S4).
- **Placeholder scan:** clean; S3's code block is complete modulo compiler-won type adjustments, explicitly delegated with "read the real signatures first".
- **Type consistency:** `DeliverableContract` S1→S2/S3; `GateResult.failures` strings quoted into critiques; `"synthesis"` marker matches the spec; `entries()` accessor flagged as a possible one-line Blackboard addition (self-contained).
- **Judgment calls:** gates run inside the judge closure so refine sees ONE critique stream; budgets-as-minimums wording (research: models undershoot); maxIterations 2 balances cost (+≤5 calls/run) vs the pilot's failure cost; v1 artifacts preserved in-repo because the loss is part of the published record.
