import { describe, it, expect } from "vitest";
import {
  orphanTruths, unmooredSubtasks, unknownCitations,
  unknownDependencies, hasCycle, coverageCritique, unjustifiedWeb, unmappedBreadth,
} from "../../src/core/coverage";
import { Truth, Subtask, CoverageMapRow, failures } from "../../src/shared/types";

const t = (id: string): Truth => ({ id, type: "constraint", statement: id, rationale: "" });
const s = (id: string, serves: string[], deps: string[] = []): Subtask =>
  ({ id, description: id, servesTruths: serves, dependsOn: deps });
const row = (dimension: string, handledBy: string, exclusionReason: string): CoverageMapRow =>
  ({ dimension, handledBy, exclusionReason });

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
    const crit = coverageCritique([t("t1")], [s("s1", ["t1"])], [row("d1", "s1", "")]);
    expect(failures(crit)).toEqual([]);
    expect(crit.verdicts).toHaveLength(7);
  });

  it("coverageCritique fails with evidence naming the offenders", () => {
    const crit = coverageCritique([t("t1"), t("t2")], [s("s1", ["t1", "t9"], ["s9"])], [row("d1", "s1", "")]);
    const failed = failures(crit).map((f) => f.criterionId);
    expect(failed).toContain("cov-orphan-truths");
    expect(failed).toContain("cov-unknown-citations");
    expect(failed).toContain("cov-unknown-deps");
    const orphan = failures(crit).find((f) => f.criterionId === "cov-orphan-truths")!;
    expect(orphan.evidence).toContain("t2");
  });

  it("flags an empty coverage map as total silent narrowing", () => {
    expect(unmappedBreadth([], [])).toEqual(["(empty coverage map)"]);
  });

  it("finds needsWeb subtasks lacking a justification", () => {
    const withWeb = (id: string, needsWeb: boolean, just: string): Subtask =>
      ({ id, description: id, servesTruths: ["t1"], dependsOn: [], needsWeb, webJustification: just });
    expect(unjustifiedWeb([withWeb("s1", true, ""), withWeb("s2", true, "fetch the linked paper"), withWeb("s3", false, "")])).toEqual(["s1"]);
  });

  it("coverageCritique includes cov-web-justified", () => {
    const crit = coverageCritique([t("t1")], [s("s1", ["t1"])], [row("d1", "s1", "")]);
    expect(crit.verdicts).toHaveLength(7);
    expect(crit.verdicts.some((v) => v.criterionId === "cov-web-justified" && v.pass)).toBe(true);
  });

  describe("unmappedBreadth", () => {
    it("passes a dimension handled by a real subtask", () => {
      expect(unmappedBreadth([row("d1", "s1", "")], [s("s1", ["t1"])])).toEqual([]);
    });

    it("passes a dimension explicitly excluded with a reason", () => {
      expect(unmappedBreadth([row("d1", "", "out of scope")], [s("s1", ["t1"])])).toEqual([]);
    });

    it("fails a dimension whose handledBy names an unknown subtask id", () => {
      expect(unmappedBreadth([row("d1", "s9", "")], [s("s1", ["t1"])])).toEqual(["d1"]);
    });

    it("fails a dimension with neither handledBy nor exclusionReason (both empty)", () => {
      expect(unmappedBreadth([row("d1", "", "")], [s("s1", ["t1"])])).toEqual(["d1"]);
    });

    it("fails a dimension with both handledBy AND exclusionReason filled", () => {
      expect(unmappedBreadth([row("d1", "s1", "convenient")], [s("s1", ["t1"])])).toEqual(["d1"]);
    });
  });

  it("coverageCritique includes cov-breadth and reports offending dimensions", () => {
    const crit = coverageCritique(
      [t("t1")],
      [s("s1", ["t1"])],
      [row("d1", "s1", ""), row("d2", "", "")]
    );
    expect(crit.verdicts).toHaveLength(7);
    const breadth = crit.verdicts.find((v) => v.criterionId === "cov-breadth")!;
    expect(breadth.pass).toBe(false);
    expect(breadth.evidence).toContain("d2");
  });
});
