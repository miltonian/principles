import { describe, it, expect } from "vitest";
import { refine } from "../../src/shared/refine";
import { Critique } from "../../src/shared/types";

const pass = (id: string) => ({ criterionId: id, pass: true, evidence: "ok" });
const fail = (id: string) => ({ criterionId: id, pass: false, evidence: "bad" });
const critique = (...verdicts: ReturnType<typeof pass>[]): Critique => ({ verdicts });

describe("refine", () => {
  it("converges immediately when the first candidate passes", async () => {
    const out = await refine(
      async () => "v1",
      async () => critique(pass("c1")),
    );
    expect(out.status).toBe("converged");
    expect(out.result).toBe("v1");
    expect(out.iterations).toBe(1);
  });

  it("feeds the critique back into produce", async () => {
    const seen: (string | null)[] = [];
    let n = 0;
    const out = await refine(
      async (fb) => { seen.push(fb ? fb.previous : null); return `v${++n}`; },
      async (c) => (c === "v1" ? critique(fail("c1")) : critique(pass("c1"))),
    );
    expect(out.status).toBe("converged");
    expect(out.result).toBe("v2");
    expect(seen).toEqual([null, "v1"]); // second call received the failed attempt
  });

  it("escalates when the same criterion fails twice in a row", async () => {
    let n = 0;
    const out = await refine(
      async () => `v${++n}`,
      async () => critique(fail("c1"), pass("c2")),
    );
    expect(out.status).toBe("escalated");
    if (out.status === "escalated") expect(out.stuckOn).toEqual(["c1"]);
    expect(out.iterations).toBe(2); // detected on the second identical failure
  });

  it("does not escalate when different criteria fail each round", async () => {
    let n = 0;
    const out = await refine(
      async () => `v${++n}`,
      async (c) =>
        c === "v1" ? critique(fail("c1")) : c === "v2" ? critique(fail("c2")) : critique(pass("c1")),
    );
    expect(out.status).toBe("converged");
    expect(out.iterations).toBe(3);
  });

  it("exhausts at maxIterations", async () => {
    let n = 0;
    const out = await refine(
      async () => `v${++n}`,
      async (c) => critique(fail(`c-${c}`)), // unique criterion each time: never repeats, never passes
      { maxIterations: 3 },
    );
    expect(out.status).toBe("exhausted");
    expect(out.iterations).toBe(3);
    expect(out.history).toHaveLength(3);
  });
});
