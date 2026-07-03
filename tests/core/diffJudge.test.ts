import { describe, it, expect } from "vitest";
import {
  buildCandidate, loadRubricCriteria, judgeDiff, renderVerdictTable,
  DIFF_CHAR_CAP, COMMENT_MARKER, DiffJudgment,
} from "../../src/core/diffJudge";
import { CompiledRubric } from "../../src/core/rubricCompiler";
import { Llm, LlmRequest } from "../../src/llm/gateway";

const rubric: CompiledRubric = {
  objective: "review a code change",
  criteria: [
    { id: "c-t1", source: "truth", truthId: "t1", description: "No new SDK imports outside the gateway.", evidenceGuidance: "Check import lines." },
    { id: "c-s1", source: "subtask", subtaskId: "s1", description: "Behavior changes carry test changes.", evidenceGuidance: "Look for test files in the diff." },
  ],
  truths: [], assumptions: [], rejectedTruths: [],
  decomposition: { status: "converged", iterations: 1 },
  gradeability: { status: "converged", iterations: 1 },
  generatedAt: "2026-07-03T00:00:00.000Z", model: "claude-opus-4-8",
};

describe("buildCandidate", () => {
  it("passes small diffs through with framing, untruncated", () => {
    const { candidate, truncated } = buildCandidate("diff --git a/x b/x\n+added line");
    expect(truncated).toBe(false);
    expect(candidate).toContain("Unified git diff under review:");
    expect(candidate).toContain("+added line");
  });

  it("truncates huge diffs on a line boundary with a loud notice", () => {
    const line = "+" + "x".repeat(99) + "\n"; // 101 chars per line
    const huge = "diff --git a/big b/big\n" + line.repeat(2000); // > cap
    const { candidate, truncated } = buildCandidate(huge);
    expect(truncated).toBe(true);
    expect(candidate.length).toBeLessThanOrEqual(DIFF_CHAR_CAP + 200); // cap + framing + notice
    expect(candidate).toContain("[diff truncated at");
    expect(candidate.split("\n").every((l) => l.length <= 120)).toBe(true); // no mid-line cut
  });
});

describe("loadRubricCriteria", () => {
  it("returns the rubric when shaped correctly", () => {
    expect(loadRubricCriteria(JSON.parse(JSON.stringify(rubric))).criteria).toHaveLength(2);
  });
  it("throws a descriptive error on malformed input", () => {
    expect(() => loadRubricCriteria({ nope: true })).toThrow(/rubric|criteria/i);
    expect(() => loadRubricCriteria({ objective: "x", criteria: "not-an-array" })).toThrow(/criteria/i);
  });
});

describe("judgeDiff", () => {
  it("judges the framed candidate against rubric.criteria with a diff-citing context", async () => {
    const capture: { req?: LlmRequest<unknown> } = {};
    const llm = (async (req: LlmRequest<unknown>) => {
      capture.req = req;
      return {
        verdicts: [
          { criterionId: "c-t1", pass: true, evidence: "no import lines added anywhere in the diff" },
          { criterionId: "c-s1", pass: false, evidence: "src/x.ts changed but no test file appears" },
        ],
      };
    }) as unknown as Llm;
    const j = await judgeDiff(llm, "diff --git a/x b/x\n+line", rubric);
    expect(capture.req!.schemaName).toBe("rubric_verdicts");
    expect(capture.req!.prompt).toContain("c-t1");
    expect(capture.req!.prompt).toContain("Unified git diff under review:");
    expect(capture.req!.prompt).toContain("Evidence required:");
    expect(capture.req!.prompt).toContain("Check import lines.");
    expect(j.critique.verdicts).toHaveLength(2);
    expect(j.truncated).toBe(false);
    expect(j.rubricObjective).toBe("review a code change");
    expect(j.criteriaCount).toBe(2);
  });
});

describe("renderVerdictTable", () => {
  const judgment: DiffJudgment = {
    critique: {
      verdicts: [
        { criterionId: "c-t1", pass: true, evidence: "clean | imports" },
        { criterionId: "c-s1", pass: false, evidence: "no tests touched" },
      ],
    },
    truncated: true,
    rubricObjective: "review a code change",
    criteriaCount: 2,
  };
  it("renders marker, advisory note, escaped rows, truncation notice, and pass/fail icons", () => {
    const md = renderVerdictTable(judgment);
    expect(md).toContain(COMMENT_MARKER);
    expect(md.toLowerCase()).toContain("advisory");
    expect(md).toContain("✅");
    expect(md).toContain("❌");
    expect(md).toContain("clean \\| imports"); // pipe escaped
    expect(md.toLowerCase()).toContain("truncated");
    expect(md).toContain("review a code change");
  });
  it("omits the truncation notice when not truncated", () => {
    const md = renderVerdictTable({ ...judgment, truncated: false });
    expect(md.toLowerCase()).not.toContain("truncated");
  });
});
