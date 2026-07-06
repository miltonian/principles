import { describe, expect, it } from "vitest";
import { buildPilotManifest, parseRowsPages, sampleTasks } from "../../src/bench/researchLoader";

const page = (rows: unknown[]) => JSON.stringify({ rows: rows.map((row) => ({ row })) });

describe("parseRowsPages", () => {
  it("parses tasks across pages and counts rubrics", () => {
    const p1 = page([{ sample_id: "b", prompt: "P-b", rubrics: [{ criterion: "c", weight: 5, axis: "a" }] }]);
    const p2 = page([{ sample_id: "a", prompt: "P-a", rubrics: [] }, { prompt: "no id" }]);
    const tasks = parseRowsPages([p1, p2]);
    expect(tasks.map((t) => t.sampleId)).toEqual(["b", "a"]);
    expect(tasks[0].rubricCount).toBe(1);
  });
});

describe("sampleTasks", () => {
  const mk = (id: string) => ({ sampleId: id, prompt: `P-${id}`, rubricCount: 1 });
  const pool = ["e", "d", "c", "b", "a"].map(mk);
  it("is deterministic under a fixed seed and caps at count", () => {
    const a = sampleTasks(pool, 3, 42).map((t) => t.sampleId);
    const b = sampleTasks(pool, 3, 42).map((t) => t.sampleId);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(sampleTasks(pool, 99, 42)).toHaveLength(5);
  });
});

describe("sampleTasks with exclude", () => {
  const mk = (id: string) => ({ sampleId: id, prompt: `P-${id}`, rubricCount: 1 });
  const pool = ["e", "d", "c", "b", "a"].map(mk);

  it("filters excluded ids before sampling, preserving determinism and count", () => {
    const exclude = new Set(["a", "b"]);
    const first = sampleTasks(pool, 3, 42, exclude).map((t) => t.sampleId);
    const second = sampleTasks(pool, 3, 42, exclude).map((t) => t.sampleId);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first).not.toContain("a");
    expect(first).not.toContain("b");
  });

  it("count is still capped, now at the remaining pool size after exclusion", () => {
    const exclude = new Set(["a", "b", "c"]);
    const result = sampleTasks(pool, 10, 42, exclude);
    expect(result).toHaveLength(2);
  });

  it("with no exclude, behaves exactly as the 3-arg call", () => {
    expect(sampleTasks(pool, 3, 42, undefined)).toEqual(sampleTasks(pool, 3, 42));
  });
});

describe("buildPilotManifest", () => {
  it("records dataset, seed, count and per-item rubric counts", () => {
    const m = buildPilotManifest([{ sampleId: "x", prompt: "p", rubricCount: 7 }], 9);
    expect(m).toEqual({ dataset: "ScaleAI/researchrubrics", seed: 9, count: 1, items: [{ sampleId: "x", rubricCount: 7 }] });
  });
});
