import { describe, it, expect } from "vitest";
import { topoLevels } from "../../src/shared/graph";

describe("topoLevels", () => {
  it("puts independent nodes in level 0", () => {
    const levels = topoLevels([
      { id: "a", dependsOn: [] },
      { id: "b", dependsOn: [] },
    ]);
    expect(levels).toEqual([["a", "b"]]);
  });

  it("orders dependents after dependencies, grouped by level", () => {
    const levels = topoLevels([
      { id: "a", dependsOn: [] },
      { id: "b", dependsOn: ["a"] },
      { id: "c", dependsOn: ["a"] },
      { id: "d", dependsOn: ["b", "c"] },
    ]);
    expect(levels).toEqual([["a"], ["b", "c"], ["d"]]);
  });

  it("returns null on a cycle", () => {
    const levels = topoLevels([
      { id: "a", dependsOn: ["b"] },
      { id: "b", dependsOn: ["a"] },
    ]);
    expect(levels).toBeNull();
  });

  it("ignores dependencies on unknown ids (validated elsewhere)", () => {
    const levels = topoLevels([{ id: "a", dependsOn: ["ghost"] }]);
    expect(levels).toEqual([["a"]]);
  });
});
