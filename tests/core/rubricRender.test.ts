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
  decomposition: { status: "converged", iterations: 1 },
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
