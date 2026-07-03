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

  it("surfaces stuckOn meta-criteria on escalation", async () => {
    const llm = (async (req: any) => {
      if (req.schemaName === "rubric_verdicts") return failIndependent;
      if (req.schemaName === "rubric_revision")
        return { criteria: [{ id: "c-invented", description: "new!", evidenceGuidance: "x" }] };
      throw new Error(`unexpected ${req.schemaName}`);
    }) as unknown as Llm;
    const out = await gradeabilityCheck(llm, "obj", guided());
    expect(out.status).toBe("escalated");
    expect(out.stuckOn).toEqual(["m-independent"]);
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
    expect(rubric.decomposition).toEqual({ status: "escalated", iterations: 2 });
    expect(rubric.gradeability).toEqual({ status: "converged", iterations: 1 });
    expect(rubric.gradeability.stuckOn).toBeUndefined(); // converged → no stuckOn
    expect(rubric.generatedAt).toBe("2026-07-03T00:00:00.000Z");
    expect(rubric.model).toBe("claude-opus-4-8");
  });
});
