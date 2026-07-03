# compile-rubric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `yarn compile-rubric "<goal>"` command that compiles a plain-language goal into an adversarially-vetted, evidence-gradeable rubric (Managed-Agents-ready `rubric.md` + provenance-rich `rubric.json`), per the approved spec `docs/superpowers/specs/2026-07-03-compile-rubric-design.md`.

**Architecture:** Extract the shared front half of `generateOntology` into `deriveFoundations()` (truths → skeptic → judged decomposition), then build the rubric compiler on top: draft criteria from constraint truths + subtasks + generics, one batched evidence-guidance call, and a gradeability meta-check that runs the rubric through the existing `refine()`/`judge()` machinery against a fixed meta-rubric. Pure renderers and a thin CLI finish it.

**Tech Stack:** Existing repo stack — TypeScript (CommonJS, strict), zod 3, `Llm` gateway (Claude Agent SDK, claude-opus-4-8), vitest, fs-extra.

## Global Constraints

- Every LLM call goes through the `Llm` type (`src/llm/gateway.ts`); tests inject fakes — no network in unit tests.
- New load-bearing schemaName strings: `rubric_guidance`, `rubric_revision` (must be added to CLAUDE.md's invariant #2 list in Task 7).
- All zod schemas structured-output-safe: closed objects, no recursion, no `$schema` (gateway strips it — do not bypass the gateway).
- `generateOntology`'s behavior and its existing tests must remain unchanged by the refactor (Task 1).
- `Criterion.source` union gains `"subtask"` — additive only; nothing in `src/runtime/` changes.
- Criterion ids: `c-<truthId>` (hard constraints), `c-<subtaskId>` (completeness), `c-responsive` / `c-grounded` (generic). Meta-rubric ids: `m-gradeable`, `m-independent`, `m-scoped`.
- Artifacts go to `rubrics/<slug>-<timestamp>/rubric.md` + `rubric.json`; `rubrics/` is gitignored.
- Console contract (CLI): assumptions ("Proceeding on these ASSUMPTIONS"), rejected truths with attacks, decomposition status, gradeability status, output paths. Never silently bless: non-converged statuses print loudly.
- Work on branch `compile-rubric` (already created from merged main, `200846c`).
- Gates: `yarn build && yarn test` green at every task's commit.

---

### Task 1: Extract `deriveFoundations` from the pipeline

**Files:**
- Create: `src/core/foundations.ts`
- Modify: `src/core/pipeline.ts`
- Test: `tests/core/foundations.test.ts`
- Existing tests that must stay green UNCHANGED: `tests/core/pipeline.test.ts`

**Interfaces:**
- Consumes: `deriveTruths` (`./truths`), `vetTruths`/`VetResult` (`./skeptic`), `decompose` (`./decompose`), `coverageCritique` (`./coverage`), `decompositionRubric` (`./rubric`), `refine`/`RefineOutcome` (`../shared/refine`), `judge` (`../shared/judge`), `failures`, `Truth`, `Subtask` (`../shared/types`), `Llm` (`../llm/gateway`).
- Produces (later tasks rely on these exact names):

```typescript
export interface Foundations {
  truths: Truth[];                       // kept + assumptions (working set)
  vet: VetResult;                        // kept / assumptions / rejected split
  subtasks: Subtask[];                   // decomposition.result
  decomposition: RefineOutcome<Subtask[]>;
}
export async function deriveFoundations(llm: Llm, objective: string): Promise<Foundations>
```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/foundations.test.ts
import { describe, it, expect } from "vitest";
import { deriveFoundations } from "../../src/core/foundations";
import { Llm, LlmRequest } from "../../src/llm/gateway";

/** Scripted fake dispatching on schemaName — same fixtures as the pipeline test. */
const scriptedLlm = (): Llm =>
  (async <T>(req: LlmRequest<T>) => {
    switch (req.schemaName) {
      case "typed_truths":
        return { truths: [{ type: "constraint", statement: "must cite sources", rationale: "r" }] };
      case "truth_attack":
        return { verdict: "survives", strongestAttack: "none", justification: "solid" };
      case "decomposition":
        return { subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [] }] };
      case "rubric_verdicts":
        return {
          verdicts: [
            { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
            { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
            { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
            { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
          ],
        };
      default:
        throw new Error(`unexpected schema ${req.schemaName}`);
    }
  }) as unknown as Llm;

describe("deriveFoundations", () => {
  it("derives, vets, and decomposes without generating agent specs", async () => {
    const f = await deriveFoundations(scriptedLlm(), "evaluate study credibility");
    expect(f.truths).toHaveLength(1);
    expect(f.truths[0].id).toBe("t1");
    expect(f.vet.kept).toHaveLength(1);
    expect(f.vet.assumptions).toHaveLength(0);
    expect(f.subtasks).toHaveLength(1);
    expect(f.subtasks[0].id).toBe("s1");
    expect(f.decomposition.status).toBe("converged");
    // No "agent_spec" schema was requested — the scripted fake would have thrown.
  });

  it("throws when every truth is rejected", async () => {
    const llm = (async <T>(req: LlmRequest<T>) => {
      if (req.schemaName === "typed_truths")
        return { truths: [{ type: "fact", statement: "x", rationale: "r" }] };
      if (req.schemaName === "truth_attack")
        return { verdict: "reject", strongestAttack: "broken", justification: "j" };
      throw new Error(`unexpected schema ${req.schemaName}`);
    }) as unknown as Llm;
    await expect(deriveFoundations(llm, "obj")).rejects.toThrow(/no truths survived/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run tests/core/foundations.test.ts`
Expected: FAIL — cannot resolve `../../src/core/foundations`.

- [ ] **Step 3: Implement `foundations.ts` by MOVING code from `pipeline.ts`**

The body below is the existing derive→vet→throw→refine block from `src/core/pipeline.ts`, moved verbatim (open `pipeline.ts` and cut it from there — do not retype from this plan if they differ; the file is authoritative):

```typescript
// src/core/foundations.ts
import { Llm } from "../llm/gateway";
import { Truth, Subtask, failures } from "../shared/types";
import { refine, RefineOutcome } from "../shared/refine";
import { judge } from "../shared/judge";
import { deriveTruths } from "./truths";
import { vetTruths, VetResult } from "./skeptic";
import { decompose } from "./decompose";
import { coverageCritique } from "./coverage";
import { decompositionRubric } from "./rubric";

export interface Foundations {
  truths: Truth[];
  vet: VetResult;
  subtasks: Subtask[];
  decomposition: RefineOutcome<Subtask[]>;
}

/**
 * The shared front half of generation: derive typed truths, vet them
 * adversarially, and produce a coverage-checked, judge-approved decomposition.
 * Consumed by both generateOntology (which adds agent specs) and
 * compileRubric (which stops here).
 */
export async function deriveFoundations(llm: Llm, objective: string): Promise<Foundations> {
  const derived = await deriveTruths(llm, objective);
  const vet = await vetTruths(llm, objective, derived);
  const truths = [...vet.kept, ...vet.assumptions];
  if (truths.length === 0) {
    throw new Error(
      `No truths survived vetting for objective "${objective}". ` +
        `Rejected: ${vet.rejected.map((r) => `${r.truth.statement} (${r.attack})`).join("; ")}`
    );
  }

  const rubric = decompositionRubric(truths);

  const decomposition = await refine<Subtask[]>(
    (feedback) => decompose(llm, objective, truths, feedback),
    async (subtasks) => {
      const mechanical = coverageCritique(truths, subtasks);
      if (failures(mechanical).length > 0) return mechanical;
      return judge(llm, {
        rubric,
        candidate: subtasks
          .map((s) => `${s.id}: ${s.description} (serves: ${s.servesTruths.join(",")}; depends: ${s.dependsOn.join(",") || "none"})`)
          .join("\n"),
        context: `Objective: ${objective}\nTruths:\n${truths.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`).join("\n")}`,
      });
    },
    { maxIterations: 5 }
  );

  return { truths, vet, subtasks: decomposition.result, decomposition };
}
```

- [ ] **Step 4: Rewire `pipeline.ts` to consume it**

Replace the moved block so `generateOntology` becomes (keep `GenerationReport` exactly as is; delete now-unused imports — `deriveTruths`, `vetTruths` type-only usage remains via `VetResult` import from `./skeptic`, `decompose`, `coverageCritique`, `decompositionRubric`, `refine`, `judge`, `failures` all move out unless still used):

```typescript
// src/core/pipeline.ts
import { Llm } from "../llm/gateway";
import { Ontology, Subtask } from "../shared/types";
import { RefineOutcome } from "../shared/refine";
import { VetResult } from "./skeptic";
import { outputRubric } from "./rubric";
import { generateAgentSpecs } from "./specs";
import { deriveFoundations } from "./foundations";

export interface GenerationReport {
  ontology: Ontology;
  vet: VetResult;
  decomposition: RefineOutcome<Subtask[]>;
}

/**
 * deriveFoundations (derive → vet → refine-with-coverage) + agent specs +
 * ontology assembly. See src/core/foundations.ts for the shared front half.
 */
export async function generateOntology(llm: Llm, objective: string): Promise<GenerationReport> {
  const f = await deriveFoundations(llm, objective);
  const agents = await generateAgentSpecs(llm, objective, f.truths, f.subtasks);

  return {
    ontology: {
      objective,
      truths: f.vet.kept,
      assumptions: f.vet.assumptions,
      subtasks: f.subtasks,
      agents,
      outputRubric: outputRubric(f.truths),
    },
    vet: f.vet,
    decomposition: f.decomposition,
  };
}
```

- [ ] **Step 5: Run the new test, the untouched pipeline test, then the full suite**

Run: `node_modules/.bin/vitest run tests/core/foundations.test.ts tests/core/pipeline.test.ts`
Expected: PASS (both files; `tests/core/pipeline.test.ts` must not have been edited).
Run: `yarn build && yarn test`
Expected: build clean; 55 existing + 2 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/foundations.ts src/core/pipeline.ts tests/core/foundations.test.ts
git commit -m "refactor: extract deriveFoundations shared by generation and rubric compilation"
```

---

### Task 2: `Criterion.source` extension and draft-criteria assembly

**Files:**
- Modify: `src/shared/types.ts` (Criterion.source union)
- Create: `src/core/rubricCompiler.ts` (types + `draftCriteria` only in this task)
- Test: `tests/core/rubricCompiler.test.ts`

**Interfaces:**
- Consumes: `Truth`, `Subtask`, `Criterion` from `src/shared/types`.
- Produces (later tasks rely on these exact names):

```typescript
// in src/shared/types.ts — the ONLY change to that file:
export interface Criterion {
  id: string;
  description: string;
  source: "truth" | "generic" | "subtask";
  truthId?: string;
}

// in src/core/rubricCompiler.ts:
export interface CompiledCriterion extends Criterion {
  subtaskId?: string;
  evidenceGuidance: string;
}
export interface CompiledRubric {
  objective: string;
  criteria: CompiledCriterion[];
  truths: Truth[];
  assumptions: Truth[];
  rejectedTruths: { statement: string; attack: string }[];
  gradeability: { status: string; iterations: number };
  generatedAt: string;
  model: string;
}
export function draftCriteria(truths: Truth[], subtasks: Subtask[]): CompiledCriterion[]
```

Order within `draftCriteria`: generic pair first (`c-responsive`, `c-grounded`), then hard constraints in truth order, then completeness in subtask order. `evidenceGuidance` starts as `""` (filled by Task 3).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/rubricCompiler.test.ts
import { describe, it, expect } from "vitest";
import { draftCriteria } from "../../src/core/rubricCompiler";
import { Truth, Subtask } from "../../src/shared/types";

const truths: Truth[] = [
  { id: "t1", type: "constraint", statement: "Verdicts must cite evidence", rationale: "" },
  { id: "t2", type: "fact", statement: "Association is not causation", rationale: "" },
  { id: "t3", type: "constraint", statement: "Scope must match the claim", rationale: "" },
];
const subtasks: Subtask[] = [
  { id: "s1", description: "Extract the study methodology", servesTruths: ["t1"], dependsOn: [] },
  { id: "s2", description: "Assess statistical rigor", servesTruths: ["t1"], dependsOn: ["s1"] },
];

describe("draftCriteria", () => {
  it("orders generic, then constraint-truth, then subtask criteria with exact ids", () => {
    const criteria = draftCriteria(truths, subtasks);
    expect(criteria.map((c) => c.id)).toEqual(["c-responsive", "c-grounded", "c-t1", "c-t3", "c-s1", "c-s2"]);
  });

  it("sets provenance fields per source", () => {
    const criteria = draftCriteria(truths, subtasks);
    const ct1 = criteria.find((c) => c.id === "c-t1")!;
    expect(ct1.source).toBe("truth");
    expect(ct1.truthId).toBe("t1");
    expect(ct1.description).toContain("Verdicts must cite evidence");
    const cs2 = criteria.find((c) => c.id === "c-s2")!;
    expect(cs2.source).toBe("subtask");
    expect(cs2.subtaskId).toBe("s2");
    expect(cs2.description).toContain("Assess statistical rigor");
    const cg = criteria.find((c) => c.id === "c-grounded")!;
    expect(cg.source).toBe("generic");
  });

  it("skips non-constraint truths and starts all evidenceGuidance empty", () => {
    const criteria = draftCriteria(truths, subtasks);
    expect(criteria.find((c) => c.id === "c-t2")).toBeUndefined();
    expect(criteria.every((c) => c.evidenceGuidance === "")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node_modules/.bin/vitest run tests/core/rubricCompiler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Make the one-line types change**

In `src/shared/types.ts`, change the `Criterion.source` line to:

```typescript
  source: "truth" | "generic" | "subtask";
```

- [ ] **Step 4: Implement `draftCriteria`**

```typescript
// src/core/rubricCompiler.ts
import { Truth, Subtask, Criterion } from "../shared/types";

export interface CompiledCriterion extends Criterion {
  subtaskId?: string;
  evidenceGuidance: string;
}

export interface CompiledRubric {
  objective: string;
  criteria: CompiledCriterion[];
  truths: Truth[];
  assumptions: Truth[];
  rejectedTruths: { statement: string; attack: string }[];
  gradeability: { status: string; iterations: number };
  generatedAt: string;
  model: string;
}

/**
 * Draft criteria from three provenanced sources. Structure is code-derived;
 * only evidence guidance and meta-check revisions involve the model.
 */
export function draftCriteria(truths: Truth[], subtasks: Subtask[]): CompiledCriterion[] {
  const generic: CompiledCriterion[] = [
    {
      id: "c-responsive",
      source: "generic",
      description: "The deliverable directly addresses the stated objective — not a generic treatment near the topic.",
      evidenceGuidance: "",
    },
    {
      id: "c-grounded",
      source: "generic",
      description: "Claims in the deliverable are grounded in provided material or clearly flagged as uncertain; nothing is fabricated.",
      evidenceGuidance: "",
    },
  ];

  const hardConstraints: CompiledCriterion[] = truths
    .filter((t) => t.type === "constraint")
    .map((t) => ({
      id: `c-${t.id}`,
      source: "truth" as const,
      truthId: t.id,
      description: `The deliverable satisfies the constraint: "${t.statement}"`,
      evidenceGuidance: "",
    }));

  const completeness: CompiledCriterion[] = subtasks.map((s) => ({
    id: `c-${s.id}`,
    source: "subtask" as const,
    subtaskId: s.id,
    description: `The deliverable adequately addresses: ${s.description}`,
    evidenceGuidance: "",
  }));

  return [...generic, ...hardConstraints, ...completeness];
}
```

- [ ] **Step 5: Run tests, build, full suite**

Run: `node_modules/.bin/vitest run tests/core/rubricCompiler.test.ts` → PASS (3 tests).
Run: `yarn build && yarn test` → all green (the `source` union change is additive; no other file compares exhaustively on it).

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/core/rubricCompiler.ts tests/core/rubricCompiler.test.ts
git commit -m "feat: draft rubric criteria from truths, subtasks, and generics with provenance"
```

---

### Task 3: Batched evidence guidance

**Files:**
- Modify: `src/core/rubricCompiler.ts` (add `addEvidenceGuidance`)
- Test: `tests/core/rubricCompiler.test.ts` (append)

**Interfaces:**
- Consumes: `Llm` from `src/llm/gateway`; `CompiledCriterion` from Task 2.
- Produces: `addEvidenceGuidance(llm: Llm, objective: string, criteria: CompiledCriterion[]): Promise<CompiledCriterion[]>` — ONE LLM call, schemaName exactly `"rubric_guidance"`. Mechanical post-rules in code: criteria missing from the response get the default guidance string `"Cite the specific passage(s) of the deliverable that satisfy this criterion."`; response entries for unknown criterionIds are dropped; input order preserved; input array not mutated.

- [ ] **Step 1: Write the failing tests (append to the existing describe file)**

```typescript
// append to tests/core/rubricCompiler.test.ts
import { addEvidenceGuidance, DEFAULT_EVIDENCE_GUIDANCE } from "../../src/core/rubricCompiler";
import { Llm, LlmRequest } from "../../src/llm/gateway";

const fakeLlm = (response: unknown, capture?: { req?: LlmRequest<unknown> }): Llm =>
  (async (req: LlmRequest<unknown>) => {
    if (capture) capture.req = req;
    return response;
  }) as unknown as Llm;

describe("addEvidenceGuidance", () => {
  const base = () => draftCriteria(truths, subtasks); // 6 criteria from Task 2 fixtures

  it("fills guidance from one batched call with schemaName rubric_guidance", async () => {
    const capture: { req?: LlmRequest<unknown> } = {};
    const llm = fakeLlm(
      { guidance: base().map((c) => ({ criterionId: c.id, evidenceGuidance: `look for ${c.id}` })) },
      capture
    );
    const out = await addEvidenceGuidance(llm, "obj", base());
    expect(capture.req!.schemaName).toBe("rubric_guidance");
    expect(out.map((c) => c.id)).toEqual(base().map((c) => c.id)); // order preserved
    expect(out.find((c) => c.id === "c-t1")!.evidenceGuidance).toBe("look for c-t1");
  });

  it("defaults guidance for criteria the model skipped and drops unknown ids", async () => {
    const llm = fakeLlm({
      guidance: [
        { criterionId: "c-t1", evidenceGuidance: "quote the citation" },
        { criterionId: "c-ghost", evidenceGuidance: "irrelevant" },
      ],
    });
    const out = await addEvidenceGuidance(llm, "obj", base());
    expect(out.find((c) => c.id === "c-t1")!.evidenceGuidance).toBe("quote the citation");
    expect(out.find((c) => c.id === "c-s1")!.evidenceGuidance).toBe(DEFAULT_EVIDENCE_GUIDANCE);
    expect(out.some((c) => (c.id as string) === "c-ghost")).toBe(false);
  });

  it("does not mutate its input", async () => {
    const input = base();
    const llm = fakeLlm({ guidance: [{ criterionId: "c-t1", evidenceGuidance: "x" }] });
    await addEvidenceGuidance(llm, "obj", input);
    expect(input.find((c) => c.id === "c-t1")!.evidenceGuidance).toBe("");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node_modules/.bin/vitest run tests/core/rubricCompiler.test.ts`
Expected: FAIL — `addEvidenceGuidance` not exported.

- [ ] **Step 3: Implement**

Add to `src/core/rubricCompiler.ts` (new imports at top: `import { z } from "zod";` and `import { Llm } from "../llm/gateway";`):

```typescript
const GuidanceSchema = z.object({
  guidance: z.array(
    z.object({
      criterionId: z.string(),
      evidenceGuidance: z.string(),
    })
  ),
});

export const DEFAULT_EVIDENCE_GUIDANCE =
  "Cite the specific passage(s) of the deliverable that satisfy this criterion.";

/**
 * One batched call: per-criterion guidance on what evidence a grader must
 * see before passing it. Mechanical spine in code: skipped criteria get a
 * safe default (never blocks compilation), unknown ids are dropped.
 */
export async function addEvidenceGuidance(
  llm: Llm,
  objective: string,
  criteria: CompiledCriterion[]
): Promise<CompiledCriterion[]> {
  const raw = await llm({
    system: [
      "You write evidence requirements for rubric criteria used by a strict grader.",
      "For each criterion, state concretely what a grader must find in a deliverable",
      "before marking it passed — observable, citable evidence, not vibes.",
      "One entry per criterion, using the exact criterionIds given.",
    ].join("\n"),
    prompt: [
      `## Objective the rubric grades against`,
      objective,
      ``,
      `## Criteria`,
      ...criteria.map((c) => `- ${c.id}: ${c.description}`),
    ].join("\n"),
    schema: GuidanceSchema,
    schemaName: "rubric_guidance",
  });

  const byId = new Map(raw.guidance.map((g) => [g.criterionId, g.evidenceGuidance]));
  return criteria.map((c) => ({
    ...c,
    evidenceGuidance: byId.get(c.id)?.trim() || DEFAULT_EVIDENCE_GUIDANCE,
  }));
}
```

- [ ] **Step 4: Run tests, build, full suite** — `yarn build && yarn test` all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/rubricCompiler.ts tests/core/rubricCompiler.test.ts
git commit -m "feat: batched evidence guidance with mechanical defaults"
```

---

### Task 4: Gradeability meta-check

**Files:**
- Modify: `src/core/rubricCompiler.ts` (add `META_RUBRIC`, `reviseCriteria`, `gradeabilityCheck`)
- Test: `tests/core/rubricCompiler.test.ts` (append)

**Interfaces:**
- Consumes: `refine`, `RefineFeedback` (`../shared/refine`); `judge` (`../shared/judge`); `failures`, `Criterion` (`../shared/types`).
- Produces:

```typescript
export const META_RUBRIC: Criterion[];  // ids m-gradeable, m-independent, m-scoped; source "generic"
export function renderCriteriaForJudging(criteria: CompiledCriterion[]): string; // pure; also reused by Task 6's markdown renderer
export async function reviseCriteria(
  llm: Llm, objective: string, current: CompiledCriterion[],
  feedback: RefineFeedback<CompiledCriterion[]>
): Promise<CompiledCriterion[]>;        // schemaName "rubric_revision"; may reword/drop, never add; unknown ids ⇒ return `current` unchanged
export async function gradeabilityCheck(
  llm: Llm, objective: string, criteria: CompiledCriterion[]
): Promise<{ criteria: CompiledCriterion[]; status: string; iterations: number }>;
```

Semantics: `gradeabilityCheck` = `refine<CompiledCriterion[]>` with `maxIterations: 3`; produce = first iteration returns the input criteria as-is, subsequent iterations call `reviseCriteria`; judge = existing `judge()` with `rubric: META_RUBRIC`, `candidate: renderCriteriaForJudging(candidateCriteria)`, `context` naming the objective. A discarded revision (unknown ids) returns the previous candidate, so the same meta-criteria fail again and `refine`'s consecutive-failure escalation terminates the loop.

- [ ] **Step 1: Write the failing tests (append)**

```typescript
// append to tests/core/rubricCompiler.test.ts
import { gradeabilityCheck, reviseCriteria, META_RUBRIC } from "../../src/core/rubricCompiler";

const guided = () =>
  draftCriteria(truths, subtasks).map((c) => ({ ...c, evidenceGuidance: "ok evidence rule" }));

const passAllMeta = {
  verdicts: META_RUBRIC.map((m) => ({ criterionId: m.id, pass: true, evidence: "meta criterion satisfied here" })),
};
const failIndependent = {
  verdicts: [
    { criterionId: "m-gradeable", pass: true, evidence: "each is evidence-checkable" },
    { criterionId: "m-independent", pass: false, evidence: "c-t1 and c-s1 double-count citation" },
    { criterionId: "m-scoped", pass: true, evidence: "all within objective" },
  ],
};

describe("gradeabilityCheck", () => {
  it("converges without revision when the meta-judge passes everything", async () => {
    let revisions = 0;
    const llm = (async (req: any) => {
      if (req.schemaName === "rubric_verdicts") return passAllMeta;
      if (req.schemaName === "rubric_revision") { revisions++; return { criteria: [] }; }
      throw new Error(`unexpected ${req.schemaName}`);
    }) as unknown as Llm;
    const out = await gradeabilityCheck(llm, "obj", guided());
    expect(out.status).toBe("converged");
    expect(out.iterations).toBe(1);
    expect(revisions).toBe(0);
    expect(out.criteria.map((c) => c.id)).toEqual(guided().map((c) => c.id));
  });

  it("revises on failure (reword + drop allowed) and converges", async () => {
    let judgeCalls = 0;
    const llm = (async (req: any) => {
      if (req.schemaName === "rubric_verdicts") return ++judgeCalls === 1 ? failIndependent : passAllMeta;
      if (req.schemaName === "rubric_revision")
        return {
          criteria: guided()
            .filter((c) => c.id !== "c-s1") // drop one — allowed
            .map((c) => ({ id: c.id, description: c.description + " (revised)", evidenceGuidance: c.evidenceGuidance })),
        };
      throw new Error(`unexpected ${req.schemaName}`);
    }) as unknown as Llm;
    const out = await gradeabilityCheck(llm, "obj", guided());
    expect(out.status).toBe("converged");
    expect(out.criteria.some((c) => c.id === "c-s1")).toBe(false);
    expect(out.criteria.find((c) => c.id === "c-t1")!.description).toContain("(revised)");
    // provenance preserved through revision:
    expect(out.criteria.find((c) => c.id === "c-t1")!.truthId).toBe("t1");
  });

  it("discards revisions that invent criterion ids and escalates on the repeat failure", async () => {
    const llm = (async (req: any) => {
      if (req.schemaName === "rubric_verdicts") return failIndependent;
      if (req.schemaName === "rubric_revision")
        return { criteria: [{ id: "c-invented", description: "new!", evidenceGuidance: "x" }] };
      throw new Error(`unexpected ${req.schemaName}`);
    }) as unknown as Llm;
    const out = await gradeabilityCheck(llm, "obj", guided());
    expect(out.status).toBe("escalated");
    expect(out.criteria.map((c) => c.id)).toEqual(guided().map((c) => c.id)); // original kept
  });
});

describe("reviseCriteria", () => {
  it("keeps provenance fields from the current criteria (model cannot touch them)", async () => {
    const current = guided();
    const llm = (async (req: any) => {
      expect(req.schemaName).toBe("rubric_revision");
      return { criteria: [{ id: "c-t1", description: "tightened", evidenceGuidance: "tighter rule" }] };
    }) as unknown as Llm;
    const out = await reviseCriteria(llm, "obj", current, {
      previous: current,
      critique: failIndependent,
    });
    const ct1 = out.find((c) => c.id === "c-t1")!;
    expect(ct1.truthId).toBe("t1");
    expect(ct1.source).toBe("truth");
    expect(ct1.description).toBe("tightened");
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `node_modules/.bin/vitest run tests/core/rubricCompiler.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement**

Add to `src/core/rubricCompiler.ts` (new imports: `refine`, `RefineFeedback` from `../shared/refine`; `judge` from `../shared/judge`; `Criterion`, `failures` already/newly imported from `../shared/types`):

```typescript
/** Falsifiability applied to the rubric itself: the meta-criteria a rubric must pass. */
export const META_RUBRIC: Criterion[] = [
  {
    id: "m-gradeable",
    source: "generic",
    description:
      "Each criterion can be marked pass/fail by pointing at evidence in a deliverable, without information the grader will not have.",
  },
  {
    id: "m-independent",
    source: "generic",
    description: "Criteria do not substantially overlap; no deliverable property is double-counted.",
  },
  {
    id: "m-scoped",
    source: "generic",
    description: "No criterion demands work outside the objective's scope.",
  },
];

/** Pure render of criteria for judging and for the markdown renderer's body. */
export function renderCriteriaForJudging(criteria: CompiledCriterion[]): string {
  return criteria
    .map((c) => `- [${c.id}] ${c.description}\n  Evidence required: ${c.evidenceGuidance}`)
    .join("\n");
}

const RevisionSchema = z.object({
  criteria: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      evidenceGuidance: z.string(),
    })
  ),
});

/**
 * Revision call for the meta-check loop. The model may reword descriptions
 * and guidance and may DROP criteria; it may never add. Provenance fields
 * are re-attached from the current criteria in code. A revision containing
 * unknown ids is discarded wholesale (returning `current`) — silently
 * filtering would be a silent bless.
 */
export async function reviseCriteria(
  llm: Llm,
  objective: string,
  current: CompiledCriterion[],
  feedback: RefineFeedback<CompiledCriterion[]>
): Promise<CompiledCriterion[]> {
  const failed = failures(feedback.critique);
  const raw = await llm({
    system: [
      "You revise a grading rubric's criteria to fix specific meta-level failures.",
      "You may reword descriptions and evidence guidance, and you may REMOVE criteria",
      "(e.g. to fix overlap). You may NOT invent new criteria or new ids.",
      "Return the full revised criteria list.",
    ].join("\n"),
    prompt: [
      `## Objective the rubric grades against`,
      objective,
      ``,
      `## Current criteria`,
      renderCriteriaForJudging(current),
      ``,
      `## Meta-failures to fix (with evidence)`,
      ...failed.map((v) => `- ${v.criterionId}: ${v.evidence}`),
      ``,
      `## Passing meta-criteria — preserve these properties`,
      ...feedback.critique.verdicts.filter((v) => v.pass).map((v) => `- ${v.criterionId}: ${v.evidence}`),
    ].join("\n"),
    schema: RevisionSchema,
    schemaName: "rubric_revision",
  });

  const currentById = new Map(current.map((c) => [c.id, c]));
  const unknown = raw.criteria.filter((r) => !currentById.has(r.id));
  if (unknown.length > 0 || raw.criteria.length === 0) {
    return current; // discarded — refine's repeat-failure escalation will terminate
  }
  return raw.criteria.map((r) => ({
    ...currentById.get(r.id)!, // provenance (source/truthId/subtaskId) from code, not the model
    description: r.description,
    evidenceGuidance: r.evidenceGuidance,
  }));
}

/** Run the rubric through refine() against META_RUBRIC. Never silently bless. */
export async function gradeabilityCheck(
  llm: Llm,
  objective: string,
  criteria: CompiledCriterion[]
): Promise<{ criteria: CompiledCriterion[]; status: string; iterations: number }> {
  const outcome = await refine<CompiledCriterion[]>(
    async (feedback) => (feedback ? reviseCriteria(llm, objective, feedback.previous, feedback) : criteria),
    (candidate) =>
      judge(llm, {
        rubric: META_RUBRIC,
        candidate: renderCriteriaForJudging(candidate),
        context: `This is a grading rubric for the objective: ${objective}. Judge the RUBRIC itself, not any deliverable.`,
      }),
    { maxIterations: 3 }
  );
  return { criteria: outcome.result, status: outcome.status, iterations: outcome.iterations };
}
```

- [ ] **Step 4: Run tests, build, full suite** — all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/rubricCompiler.ts tests/core/rubricCompiler.test.ts
git commit -m "feat: gradeability meta-check — the rubric must pass its own rubric"
```

---

### Task 5: `compileRubric` orchestration

**Files:**
- Modify: `src/core/rubricCompiler.ts` (add `compileRubric`)
- Test: `tests/core/rubricCompiler.test.ts` (append)

**Interfaces:**
- Consumes: `deriveFoundations` (Task 1), `draftCriteria` (Task 2), `addEvidenceGuidance` (Task 3), `gradeabilityCheck` (Task 4).
- Produces: `compileRubric(llm: Llm, objective: string, now?: () => Date): Promise<CompiledRubric>` — `now` defaults to `() => new Date()` (injectable for tests); `model` field hardcoded `"claude-opus-4-8"` (matches the gateway default).

- [ ] **Step 1: Write the failing test (append)**

```typescript
// append to tests/core/rubricCompiler.test.ts
import { compileRubric } from "../../src/core/rubricCompiler";

describe("compileRubric", () => {
  it("runs foundations → draft → guidance → meta-check and assembles provenance", async () => {
    const llm = (async (req: any) => {
      switch (req.schemaName) {
        case "typed_truths":
          return {
            truths: [
              { type: "constraint", statement: "must cite sources", rationale: "r" },
              { type: "fact", statement: "unverifiable-ish claim", rationale: "r" },
            ],
          };
        case "truth_attack":
          // first truth survives; second demoted to assumption
          return req.prompt.includes("must cite sources")
            ? { verdict: "survives", strongestAttack: "none", justification: "solid" }
            : { verdict: "demote", strongestAttack: "cannot verify", justification: "j" };
        case "decomposition":
          return { subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [] }] };
        case "rubric_verdicts":
          // passes BOTH the decomposition judge (d-*) and the meta-judge (m-*):
          return req.prompt.includes("m-gradeable")
            ? { verdicts: [
                { criterionId: "m-gradeable", pass: true, evidence: "all evidence-checkable" },
                { criterionId: "m-independent", pass: true, evidence: "no overlap found" },
                { criterionId: "m-scoped", pass: true, evidence: "all in scope" },
              ] }
            : { verdicts: [
                { criterionId: "d-minimal", pass: true, evidence: "atomic" },
                { criterionId: "d-feasible", pass: true, evidence: "text-only" },
                { criterionId: "d-complete", pass: true, evidence: "covers objective" },
                { criterionId: "d-t1", pass: true, evidence: "constraint carried" },
              ] };
        case "rubric_guidance":
          return { guidance: [{ criterionId: "c-t1", evidenceGuidance: "quote the citation" }] };
        default:
          throw new Error(`unexpected schema ${req.schemaName}`);
      }
    }) as unknown as Llm;

    const rubric = await compileRubric(llm, "evaluate study credibility", () => new Date("2026-07-03T00:00:00Z"));
    expect(rubric.objective).toBe("evaluate study credibility");
    expect(rubric.criteria.map((c) => c.id)).toEqual(["c-responsive", "c-grounded", "c-t1", "c-s1"]);
    expect(rubric.criteria.find((c) => c.id === "c-t1")!.evidenceGuidance).toBe("quote the citation");
    expect(rubric.criteria.find((c) => c.id === "c-s1")!.evidenceGuidance.length).toBeGreaterThan(0); // default applied
    expect(rubric.truths.map((t) => t.id)).toEqual(["t1"]);       // kept only
    expect(rubric.assumptions).toHaveLength(1);                    // demoted t2
    expect(rubric.rejectedTruths).toEqual([]);
    expect(rubric.gradeability).toEqual({ status: "converged", iterations: 1 });
    expect(rubric.generatedAt).toBe("2026-07-03T00:00:00.000Z");
    expect(rubric.model).toBe("claude-opus-4-8");
  });
});
```

Note for the implementer: the `truth_attack` dispatch inspects `req.prompt` — `vetTruths` puts the truth's statement in the prompt (see `src/core/skeptic.ts`), and the meta vs decomposition `rubric_verdicts` dispatch keys off `META_RUBRIC` criterion ids appearing in the judge's prompt. Both are existing, tested behaviors.

- [ ] **Step 2: Run to verify failure** — FAIL (`compileRubric` not exported).

- [ ] **Step 3: Implement**

Add to `src/core/rubricCompiler.ts` (new import: `deriveFoundations` from `./foundations`):

```typescript
/**
 * The compile-rubric product: foundations (derive → skeptic → judged
 * decomposition) → provenanced draft criteria → batched evidence guidance →
 * gradeability meta-check. Stops before agent-spec generation.
 */
export async function compileRubric(
  llm: Llm,
  objective: string,
  now: () => Date = () => new Date()
): Promise<CompiledRubric> {
  const f = await deriveFoundations(llm, objective);
  const drafted = draftCriteria(f.truths, f.subtasks);
  const guided = await addEvidenceGuidance(llm, objective, drafted);
  const checked = await gradeabilityCheck(llm, objective, guided);

  return {
    objective,
    criteria: checked.criteria,
    truths: f.vet.kept,
    assumptions: f.vet.assumptions,
    rejectedTruths: f.vet.rejected.map((r) => ({ statement: r.truth.statement, attack: r.attack })),
    gradeability: { status: checked.status, iterations: checked.iterations },
    generatedAt: now().toISOString(),
    model: "claude-opus-4-8",
  };
}
```

- [ ] **Step 4: Run tests, build, full suite** — all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/rubricCompiler.ts tests/core/rubricCompiler.test.ts
git commit -m "feat: compileRubric orchestration over foundations, guidance, and meta-check"
```

---

### Task 6: Renderers and artifact writer

**Files:**
- Create: `src/core/rubricRender.ts`
- Test: `tests/core/rubricRender.test.ts`

**Interfaces:**
- Consumes: `CompiledRubric`, `CompiledCriterion`, `renderCriteriaForJudging` from `./rubricCompiler`; `fs-extra`, `path`.
- Produces:

```typescript
export function renderRubricMarkdown(rubric: CompiledRubric): string;
export function renderRubricJson(rubric: CompiledRubric): string;   // JSON.stringify(rubric, null, 2) + "\n"
export function slugify(objective: string): string;                  // kebab-case, [a-z0-9-], max 40 chars, no leading/trailing "-"
export function writeRubricArtifacts(
  rubric: CompiledRubric, rubricsRoot: string, now?: () => Date
): { dir: string; mdPath: string; jsonPath: string };
```

Markdown contract (from the spec): title line `# Rubric: <objective>`; one-line usage note ("Attach as the rubric for an outcome-driven agent; a grader marks each criterion pass/fail with cited evidence."); `## Hard constraints` section (truth-sourced), `## Completeness` section (subtask-sourced), `## General` section (generic) — each criterion as `- [id] description` + indented `Evidence required: …` (reuse `renderCriteriaForJudging` per group). No prose padding. Dir name: `<slugify(objective)>-<epoch-millis from now()>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/core/rubricRender.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { renderRubricMarkdown, renderRubricJson, slugify, writeRubricArtifacts } from "../../src/core/rubricRender";
import { CompiledRubric } from "../../src/core/rubricCompiler";

const rubric: CompiledRubric = {
  objective: "Evaluate vendor security proposals!",
  criteria: [
    { id: "c-responsive", source: "generic", description: "Addresses the objective.", evidenceGuidance: "Point at the sections." },
    { id: "c-t1", source: "truth", truthId: "t1", description: "Satisfies: cite evidence.", evidenceGuidance: "Quote citations." },
    { id: "c-s1", source: "subtask", subtaskId: "s1", description: "Addresses: methodology extraction.", evidenceGuidance: "Show the extraction." },
  ],
  truths: [{ id: "t1", type: "constraint", statement: "cite evidence", rationale: "" }],
  assumptions: [{ id: "t2", type: "assumption", statement: "single proposal at a time", rationale: "" }],
  rejectedTruths: [{ statement: "broken claim", attack: "counterexample" }],
  gradeability: { status: "converged", iterations: 1 },
  generatedAt: "2026-07-03T00:00:00.000Z",
  model: "claude-opus-4-8",
};

describe("renderRubricMarkdown", () => {
  it("renders title, usage note, grouped criteria, and evidence lines", () => {
    const md = renderRubricMarkdown(rubric);
    expect(md).toContain("# Rubric: Evaluate vendor security proposals!");
    expect(md.indexOf("## Hard constraints")).toBeLessThan(md.indexOf("## Completeness"));
    expect(md.indexOf("## Completeness")).toBeLessThan(md.indexOf("## General"));
    expect(md).toContain("[c-t1] Satisfies: cite evidence.");
    expect(md).toContain("Evidence required: Quote citations.");
    expect(md).toContain("[c-s1]");
    expect(md).toContain("[c-responsive]");
  });
});

describe("renderRubricJson", () => {
  it("round-trips", () => {
    expect(JSON.parse(renderRubricJson(rubric))).toEqual(rubric);
  });
});

describe("slugify", () => {
  it("kebab-cases, strips punctuation, caps at 40 chars", () => {
    expect(slugify("Evaluate vendor security proposals!")).toBe("evaluate-vendor-security-proposals");
    expect(slugify("A".repeat(80)).length).toBeLessThanOrEqual(40);
    expect(slugify("  weird -- spacing  ")).toBe("weird-spacing");
  });
});

describe("writeRubricArtifacts", () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rubric-test-")); });
  afterEach(() => { fs.removeSync(tmp); });

  it("writes both artifacts under a slug-timestamp dir", () => {
    const out = writeRubricArtifacts(rubric, tmp, () => new Date(1234567890));
    expect(out.dir).toBe(path.join(tmp, "evaluate-vendor-security-proposals-1234567890"));
    expect(fs.readFileSync(out.mdPath, "utf8")).toContain("# Rubric:");
    expect(JSON.parse(fs.readFileSync(out.jsonPath, "utf8")).model).toBe("claude-opus-4-8");
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL, module not found.

- [ ] **Step 3: Implement**

```typescript
// src/core/rubricRender.ts
import fs from "fs-extra";
import path from "path";
import { CompiledRubric, CompiledCriterion, renderCriteriaForJudging } from "./rubricCompiler";

/** Mechanical rendering from data — cannot hallucinate. */
export function renderRubricMarkdown(rubric: CompiledRubric): string {
  const group = (label: string, items: CompiledCriterion[]) =>
    items.length ? [`## ${label}`, renderCriteriaForJudging(items), ``] : [];

  const lines = [
    `# Rubric: ${rubric.objective}`,
    ``,
    `Attach as the rubric for an outcome-driven agent; a grader marks each criterion pass/fail with cited evidence.`,
    ``,
    ...group("Hard constraints", rubric.criteria.filter((c) => c.source === "truth")),
    ...group("Completeness", rubric.criteria.filter((c) => c.source === "subtask")),
    ...group("General", rubric.criteria.filter((c) => c.source === "generic")),
  ];
  return lines.join("\n").replace(/\n+$/, "\n");
}

export function renderRubricJson(rubric: CompiledRubric): string {
  return JSON.stringify(rubric, null, 2) + "\n";
}

export function slugify(objective: string): string {
  return objective
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function writeRubricArtifacts(
  rubric: CompiledRubric,
  rubricsRoot: string,
  now: () => Date = () => new Date()
): { dir: string; mdPath: string; jsonPath: string } {
  const dir = path.join(rubricsRoot, `${slugify(rubric.objective)}-${now().getTime()}`);
  fs.ensureDirSync(dir);
  const mdPath = path.join(dir, "rubric.md");
  const jsonPath = path.join(dir, "rubric.json");
  fs.writeFileSync(mdPath, renderRubricMarkdown(rubric), "utf8");
  fs.writeFileSync(jsonPath, renderRubricJson(rubric), "utf8");
  return { dir, mdPath, jsonPath };
}
```

- [ ] **Step 4: Run tests, build, full suite** — all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/rubricRender.ts tests/core/rubricRender.test.ts
git commit -m "feat: mechanical rubric renderers and artifact writer"
```

---

### Task 7: CLI, gitignore, CLAUDE.md

**Files:**
- Create: `src/scripts/rubricCli.ts`
- Modify: `package.json` (add script), `.gitignore` (add `rubrics/`), `CLAUDE.md` (invariant #2 schemaName list + commands section)

**Interfaces:**
- Consumes: `compileRubric` (Task 5), `writeRubricArtifacts` (Task 6), `makeClaudeAgentSdkLlm` (`../llm/claudeGateway`).
- Produces: `yarn compile-rubric "<goal>"` end-to-end. No new exports.

- [ ] **Step 1: Implement the CLI** (mirror `src/scripts/agentGenerator.ts`'s conventions exactly — dotenv first, warn-don't-exit on missing key):

```typescript
// src/scripts/rubricCli.ts
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import { makeClaudeAgentSdkLlm } from "../llm/claudeGateway";
import { compileRubric } from "../core/rubricCompiler";
import { writeRubricArtifacts } from "../core/rubricRender";

const main = async () => {
  const objective = process.argv.slice(2).join(" ");
  if (!objective) {
    console.error('Usage: yarn compile-rubric "<goal to compile a rubric for>"');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set — relying on local Claude Code credentials if available.");
  }

  const llm = makeClaudeAgentSdkLlm();
  console.log("Deriving and vetting truths, decomposing, compiling rubric...");
  const rubric = await compileRubric(llm, objective);

  if (rubric.assumptions.length > 0) {
    console.log("\nProceeding on these ASSUMPTIONS (correct me if wrong):");
    for (const a of rubric.assumptions) console.log(`  - ${a.statement}`);
  }
  if (rubric.rejectedTruths.length > 0) {
    console.log("\nRejected candidate truths:");
    for (const r of rubric.rejectedTruths) console.log(`  - "${r.statement}" — ${r.attack}`);
  }
  console.log(`\nGradeability check: ${rubric.gradeability.status} after ${rubric.gradeability.iterations} iteration(s).`);
  if (rubric.gradeability.status !== "converged") {
    console.log("  The rubric did NOT fully pass its own meta-rubric — review it before trusting it.");
  }

  const baseDir = path.join(__dirname, "..", "..");
  const out = writeRubricArtifacts(rubric, path.join(baseDir, "rubrics"));
  console.log(`\nRubric written:\n  ${out.mdPath}\n  ${out.jsonPath}`);
  console.log(`Criteria: ${rubric.criteria.length} (use rubric.md as an Outcome rubric; rubric.json carries provenance).`);
};

main().catch((err) => {
  console.error("Rubric compilation failed:", err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Wire up script and gitignore**

In `package.json` scripts, after `generate-agents`, add:

```json
"compile-rubric": "yarn build && node dist/scripts/rubricCli.js",
```

Append to `.gitignore`:

```
rubrics/
```

- [ ] **Step 3: Update CLAUDE.md**

In invariant #2, extend the schemaName list with `rubric_guidance` and `rubric_revision` (same sentence structure). In the Commands section, after the `generate-agents` line, add:

```markdown
- `yarn compile-rubric "<goal>"` — compile a gradeable rubric only (foundations, no agent specs; see the `live-verification` skill for run guidance)
```

- [ ] **Step 4: Verify** — `yarn build && yarn test` green; then a dry sanity check that the CLI fails gracefully with no args: `node dist/scripts/rubricCli.js` → prints usage, exit 1.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/rubricCli.ts package.json .gitignore CLAUDE.md
git commit -m "feat: compile-rubric CLI, artifact dir ignore, invariant updates"
```

---

### Task 8: Live end-to-end compile (requires Claude credentials)

**Files:** none created (manual gate; findings go in the PR description).

- [ ] **Step 1: Launch observably** (per `.claude/skills/live-verification` — log to file, watchdog on):

```bash
CLAUDE_ENABLE_STREAM_WATCHDOG=1 CLAUDE_STREAM_IDLE_TIMEOUT_MS=120000 \
  yarn compile-rubric "evaluate whether a vendor proposal satisfies our security requirements" \
  > rubric-run.log 2>&1 &
```

Expected wall-clock: ~3–6 min healthy (fewer calls than a package compile — no agent specs). If silent >10 min, use the skill's stage probe; the new stages appear as prompts containing "evidence requirements for rubric criteria" (`rubric_guidance`) and "revise a grading rubric's criteria" (`rubric_revision`).

- [ ] **Step 2: Verify console contract** — log shows assumptions, any rejected truths with attacks, decomposition status, gradeability status, both output paths.

- [ ] **Step 3: Verify artifacts by eye** — `rubric.md` matches the format contract (title, usage note, three groups, every criterion has an `Evidence required` line, no prose padding); `rubric.json` has full provenance (every `c-t*` has `truthId`, every `c-s*` has `subtaskId`), assumptions and rejected truths recorded, `gradeability.status` present.

- [ ] **Step 4: Fix anything found (TDD for each fix), commit** — `git commit -m "fix: adjustments from live compile-rubric run"` (skip if clean).

---

## Self-Review Notes

- **Spec coverage:** deriveFoundations extraction (T1), Criterion source + provenance (T2), evidence guidance batched call + default (T3), META_RUBRIC/gradeability/refine loop/id-immutability/discard-on-unknown (T4), compileRubric assembly + injectable clock + model field (T5), renderers/slug/artifact writer (T6), CLI console contract + gitignore + CLAUDE.md schemaNames (T7), live gate with the spec's example goal + stage-probe (T8). Error-handling section: zero-truths throw preserved verbatim in T1; escalated statuses printed loudly in T7; unknown-id revision discard in T4.
- **Placeholder scan:** clean — every code step has complete code; T8 is a manual gate with concrete commands and checks.
- **Type consistency:** `Foundations{truths,vet,subtasks,decomposition}` (T1) consumed in T5; `CompiledCriterion{subtaskId?,evidenceGuidance}` and `CompiledRubric` (T2) used by T3–T6 verbatim; `renderCriteriaForJudging` defined T4, reused T6; schemaNames `rubric_guidance` (T3) / `rubric_revision` (T4) match T5's scripted fake and T7's CLAUDE.md addition; `writeRubricArtifacts(rubric, rubricsRoot, now?)` (T6) matches T7's call.
- **Judgment calls:** first meta-check iteration judges the unrevised criteria (so a clean rubric costs exactly one meta-judge call); `model` hardcoded to the gateway default rather than threaded through (YAGNI — revisit if per-call model override ever lands); generic criteria worded slightly differently from runtime's `o-*` pair because a rubric grades any deliverable, not an agent answer.
