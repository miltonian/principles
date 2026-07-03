import { describe, it, expect } from "vitest";
import { run, JudgeDiffDeps } from "../../src/scripts/judgeDiff";
import { Llm } from "../../src/llm/gateway";

const rubricJson = JSON.stringify({
  objective: "review a code change",
  criteria: [{ id: "c-t1", source: "truth", truthId: "t1", description: "d", evidenceGuidance: "g" }],
  truths: [], assumptions: [], rejectedTruths: [],
  decomposition: { status: "converged", iterations: 1 },
  gradeability: { status: "converged", iterations: 1 },
  generatedAt: "2026-07-03T00:00:00.000Z", model: "claude-opus-4-8",
});

const passLlm: Llm = (async () => ({
  verdicts: [{ criterionId: "c-t1", pass: true, evidence: "evidence long enough here" }],
})) as unknown as Llm;
const failLlm: Llm = (async () => ({
  verdicts: [{ criterionId: "c-t1", pass: false, evidence: "src/x.ts changed, no tests" }],
})) as unknown as Llm;

const makeDeps = (over: Partial<JudgeDiffDeps> = {}): { deps: JudgeDiffDeps; out: string[]; err: string[]; execs: string[] } => {
  const out: string[] = []; const err: string[] = []; const execs: string[] = [];
  const defaultExec = (cmd: string) => { execs.push(cmd); if (cmd.startsWith("git diff")) return "diff --git a/x b/x\n+line"; return ""; };
  const { exec: overExec, ...overRest } = over;
  const exec = overExec ? (cmd: string) => { execs.push(cmd); return overExec(cmd); } : defaultExec;
  const deps: JudgeDiffDeps = {
    llm: passLlm,
    exec,
    readFile: () => rubricJson,
    log: (s) => out.push(s),
    error: (s) => err.push(s),
    ...overRest,
  };
  return { deps, out, err, execs };
};

describe("run", () => {
  it("judges the default range and prints the table, exit 0", async () => {
    const { deps, out, execs } = makeDeps();
    const code = await run([], deps);
    expect(code).toBe(0);
    expect(execs[0]).toBe("git diff origin/main...HEAD");
    expect(out.join("\n")).toContain("| `c-t1` | ✅ PASS |");
  });

  it("--strict exits 1 on failures, 0 on all-pass", async () => {
    const failing = makeDeps({ llm: failLlm });
    expect(await run(["--strict"], failing.deps)).toBe(1);
    const passing = makeDeps();
    expect(await run(["--strict"], passing.deps)).toBe(0);
  });

  it("empty diff → notice, exit 0, no LLM call", async () => {
    let llmCalled = false;
    const { deps, out } = makeDeps({
      llm: (async () => { llmCalled = true; return { verdicts: [] }; }) as unknown as Llm,
      exec: (cmd) => (cmd.startsWith("git diff") ? "" : ""),
    });
    expect(await run([], deps)).toBe(0);
    expect(llmCalled).toBe(false);
    expect(out.join("\n").toLowerCase()).toContain("no changes");
  });

  it("missing rubric file → exit 2 naming the regeneration command", async () => {
    const { deps, err } = makeDeps({ readFile: () => { throw new Error("ENOENT"); } });
    expect(await run([], deps)).toBe(2);
    expect(err.join("\n")).toContain("compile-rubric");
  });

  it("git failure → exit 2", async () => {
    const { deps } = makeDeps({ exec: () => { throw new Error("bad range"); } });
    expect(await run(["--range", "a...b"], deps)).toBe(2);
  });

  it("unknown flag → exit 2", async () => {
    const { deps, err } = makeDeps();
    expect(await run(["--bogus"], deps)).toBe(2);
    expect(err.join("\n")).toContain("--bogus");
  });

  it("--comment upserts: creates when no marker comment exists", async () => {
    const { deps, execs } = makeDeps({
      exec: (cmd) => {
        if (cmd.startsWith("git diff")) return "diff --git a/x b/x\n+line";
        if (cmd.includes("pr view")) return "42";
        if (cmd.includes("issues/42/comments")) return ""; // no existing marker comment
        return "";
      },
    });
    expect(await run(["--comment"], deps)).toBe(0);
    expect(execs.some((c) => c.includes("pr comment 42"))).toBe(true);
  });

  it("--comment updates in place when the marker comment exists", async () => {
    const { deps, execs } = makeDeps({
      exec: (cmd) => {
        if (cmd.startsWith("git diff")) return "diff --git a/x b/x\n+line";
        if (cmd.includes("pr view")) return "42";
        if (cmd.includes("issues/42/comments") && !cmd.includes("PATCH")) return "9001";
        return "";
      },
    });
    expect(await run(["--comment"], deps)).toBe(0);
    expect(execs.some((c) => c.includes("-X PATCH") && c.includes("comments/9001"))).toBe(true);
    expect(execs.some((c) => c.includes("pr comment"))).toBe(false);
  });

  it("--comment without PR context warns and exits 0", async () => {
    const { deps, err } = makeDeps({
      exec: (cmd) => {
        if (cmd.startsWith("git diff")) return "diff --git a/x b/x\n+line";
        if (cmd.includes("pr view")) throw new Error("no PR");
        return "";
      },
    });
    expect(await run(["--comment"], deps)).toBe(0);
    expect(err.join("\n").toLowerCase()).toContain("pr context");
  });

  it("--comment posting failure warns and still exits 0", async () => {
    const { deps, err, out } = makeDeps({
      exec: (cmd) => {
        if (cmd.startsWith("git diff")) return "diff --git a/x b/x\n+line";
        if (cmd.includes("pr view")) return "42";
        if (cmd.includes("issues/42/comments")) return "";
        if (cmd.includes("pr comment")) throw new Error("HTTP 403: Resource not accessible");
        return "";
      },
    });
    expect(await run(["--comment"], deps)).toBe(0);
    expect(err.join("\n").toLowerCase()).toContain("failed to post");
    expect(out.join("\n")).toContain("| `c-t1` |"); // table still printed
  });
});
