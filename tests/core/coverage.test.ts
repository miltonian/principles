import { describe, it, expect } from "vitest";
import {
  orphanTruths, unmooredSubtasks, unknownCitations,
  unknownDependencies, hasCycle, coverageCritique, unjustifiedWeb,
} from "../../src/core/coverage";
import { Truth, Subtask, failures } from "../../src/shared/types";

const t = (id: string): Truth => ({ id, type: "constraint", statement: id, rationale: "" });
const s = (id: string, serves: string[], deps: string[] = []): Subtask =>
  ({ id, description: id, servesTruths: serves, dependsOn: deps });

describe("coverage checks", () => {
  it("finds truths no subtask serves", () => {
    expect(orphanTruths([t("t1"), t("t2")], [s("s1", ["t1"])])).toEqual(["t2"]);
  });

  it("finds subtasks citing no truths", () => {
    expect(unmooredSubtasks([s("s1", []), s("s2", ["t1"])])).toEqual(["s1"]);
  });

  it("finds citations of unknown truth ids", () => {
    expect(unknownCitations([t("t1")], [s("s1", ["t1", "t9"])])).toEqual(["t9"]);
  });

  it("finds dependencies on unknown subtask ids", () => {
    expect(unknownDependencies([s("s1", ["t1"], ["s7"])])).toEqual(["s7"]);
  });

  it("detects cycles", () => {
    expect(hasCycle([s("s1", ["t1"], ["s2"]), s("s2", ["t1"], ["s1"])])).toBe(true);
    expect(hasCycle([s("s1", ["t1"]), s("s2", ["t1"], ["s1"])])).toBe(false);
  });

  it("coverageCritique passes a clean decomposition", () => {
    const crit = coverageCritique([t("t1")], [s("s1", ["t1"])]);
    expect(failures(crit)).toEqual([]);
    expect(crit.verdicts).toHaveLength(6);
  });

  it("coverageCritique fails with evidence naming the offenders", () => {
    const crit = coverageCritique([t("t1"), t("t2")], [s("s1", ["t1", "t9"], ["s9"])]);
    const failed = failures(crit).map((f) => f.criterionId);
    expect(failed).toContain("cov-orphan-truths");
    expect(failed).toContain("cov-unknown-citations");
    expect(failed).toContain("cov-unknown-deps");
    const orphan = failures(crit).find((f) => f.criterionId === "cov-orphan-truths")!;
    expect(orphan.evidence).toContain("t2");
  });

  it("finds needsWeb subtasks lacking a justification", () => {
    const withWeb = (id: string, needsWeb: boolean, just: string): Subtask =>
      ({ id, description: id, servesTruths: ["t1"], dependsOn: [], needsWeb, webJustification: just });
    expect(unjustifiedWeb([withWeb("s1", true, ""), withWeb("s2", true, "fetch the linked paper"), withWeb("s3", false, "")])).toEqual(["s1"]);
  });

  it("coverageCritique includes cov-web-justified", () => {
    const crit = coverageCritique([t("t1")], [s("s1", ["t1"])]);
    expect(crit.verdicts).toHaveLength(6);
    expect(crit.verdicts.some((v) => v.criterionId === "cov-web-justified" && v.pass)).toBe(true);
  });
});
