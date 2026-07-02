import { describe, it, expect } from "vitest";
import { decompositionRubric, outputRubric } from "../../src/core/rubric";
import { Truth } from "../../src/shared/types";

const truths: Truth[] = [
  { id: "t1", type: "constraint", statement: "Answers must cite sources", rationale: "" },
  { id: "t2", type: "fact", statement: "Domain is medical studies", rationale: "" },
  { id: "t3", type: "constraint", statement: "Output is a single report", rationale: "" },
];

describe("rubric builders", () => {
  it("decompositionRubric = generics + one criterion per constraint truth", () => {
    const rubric = decompositionRubric(truths);
    expect(rubric.map((c) => c.id)).toEqual(["d-minimal", "d-feasible", "d-complete", "d-t1", "d-t3"]);
    const dt1 = rubric.find((c) => c.id === "d-t1")!;
    expect(dt1.source).toBe("truth");
    expect(dt1.truthId).toBe("t1");
    expect(dt1.description).toContain("Answers must cite sources");
  });

  it("outputRubric = generics + one criterion per constraint truth", () => {
    const rubric = outputRubric(truths);
    expect(rubric.map((c) => c.id)).toEqual(["o-responsive", "o-grounded", "o-t1", "o-t3"]);
  });
});
