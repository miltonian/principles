import { describe, it, expect } from "vitest";
import { run, PilotDeps } from "../../src/scripts/researchPilot";
import { Llm } from "../../src/llm/gateway";
import { PrinciplesRunners } from "../../src/bench/researchArms";

const page = (rows: unknown[]) => JSON.stringify({ rows: rows.map((row) => ({ row })) });

const FIXED_NOW = "2026-07-03T00:00:00.000Z";

/** In-memory fake filesystem shared by all deps helpers in a test. */
function makeFakeFs() {
  const files = new Map<string, string>();
  const dirs = new Set<string>();

  const exists = (p: string) => files.has(p) || dirs.has(p) || [...files.keys()].some((f) => f.startsWith(`${p}/`));
  const readFile = (p: string) => {
    const content = files.get(p);
    if (content === undefined) throw new Error(`ENOENT: ${p}`);
    return content;
  };
  const writeFile = (p: string, content: string) => { files.set(p, content); };
  const appendFile = (p: string, content: string) => { files.set(p, (files.get(p) ?? "") + content); };
  const mkdirp = (p: string) => { dirs.add(p); };
  const listDir = (p: string) => {
    const prefix = `${p}/`;
    return [...files.keys()]
      .filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes("/"))
      .map((f) => f.slice(prefix.length));
  };

  return { files, dirs, exists, readFile, writeFile, appendFile, mkdirp, listDir };
}

const makeDeps = (over: Partial<PilotDeps> = {}, fakeFs = makeFakeFs()) => {
  const out: string[] = [];
  const err: string[] = [];
  const llmCalls: unknown[] = [];
  const llm: Llm = (async (req: unknown) => { llmCalls.push(req); return { report: "# Fixed Report" }; }) as unknown as Llm;

  const deps: PilotDeps = {
    llm,
    fetchText: async () => "{}",
    readFile: fakeFs.readFile,
    writeFile: fakeFs.writeFile,
    appendFile: fakeFs.appendFile,
    exists: fakeFs.exists,
    mkdirp: fakeFs.mkdirp,
    listDir: fakeFs.listDir,
    log: (s: string) => out.push(s),
    error: (s: string) => err.push(s),
    confirmYes: false,
    now: () => FIXED_NOW,
    ...over,
  };
  return { deps, out, err, llmCalls, fakeFs };
};

describe("research-pilot fetch", () => {
  it("writes a manifest with 10 items sampled from 2 fetched pages of 12 tasks", async () => {
    const twelve = Array.from({ length: 12 }, (_, i) => ({
      sample_id: `s${String(i + 1).padStart(2, "0")}`,
      prompt: `Prompt ${i + 1}`,
      rubrics: [{ criterion: "c", weight: 1, axis: "a" }],
    }));
    const fetchText = async (url: string) => {
      if (url.includes("offset=0")) return page(twelve);
      if (url.includes("offset=100")) return page([]);
      throw new Error(`unexpected url ${url}`);
    };
    const { deps, out, fakeFs } = makeDeps({ fetchText });

    const code = await run(["fetch"], deps);

    expect(code).toBe(0);
    const manifest = JSON.parse(fakeFs.files.get("benchmarks/research-pilot/manifest.json")!);
    expect(manifest.dataset).toBe("ScaleAI/researchrubrics");
    expect(manifest.seed).toBe(20260703);
    expect(manifest.count).toBe(10);
    expect(manifest.items).toHaveLength(10);
    expect(out.some((l) => l.includes("10"))).toBe(true);
    // exactly 2 pages were cached
    expect([...fakeFs.files.keys()].filter((f) => f.startsWith(".bench-cache/researchrubrics/page-"))).toHaveLength(2);
  });

  it("refuses to overwrite the manifest when any response file already exists, even without a manifest", async () => {
    const { deps, err, fakeFs } = makeDeps();
    fakeFs.files.set("benchmarks/research-pilot/responses/bare/leftover.md", "stale");

    const code = await run(["fetch"], deps);

    expect(code).toBe(2);
    expect(err.join("\n")).toContain("responses/bare/leftover.md");
    expect(fakeFs.files.has("benchmarks/research-pilot/manifest.json")).toBe(false);
  });
});

function seedManifestAndCache(fakeFs: ReturnType<typeof makeFakeFs>, items: { sampleId: string; prompt: string }[]) {
  const manifest = {
    dataset: "ScaleAI/researchrubrics",
    seed: 20260703,
    count: items.length,
    items: items.map((it) => ({ sampleId: it.sampleId, rubricCount: 2 })),
  };
  fakeFs.files.set("benchmarks/research-pilot/manifest.json", JSON.stringify(manifest));
  fakeFs.files.set(
    ".bench-cache/researchrubrics/page-0.json",
    page(items.map((it) => ({ sample_id: it.sampleId, prompt: it.prompt, rubrics: [] })))
  );
  fakeFs.dirs.add(".bench-cache/researchrubrics");
}

describe("research-pilot run", () => {
  it("refuses to run without --yes (confirmYes), invoking the arm zero times, and reports the remaining count", async () => {
    const { deps, err, llmCalls, fakeFs } = makeDeps({ confirmYes: false });
    seedManifestAndCache(fakeFs, [
      { sampleId: "a", prompt: "Prompt A" },
      { sampleId: "b", prompt: "Prompt B" },
      { sampleId: "c", prompt: "Prompt C" },
    ]);

    const code = await run(["run", "--arm", "bare"], deps);

    expect(code).toBe(2);
    expect(llmCalls).toHaveLength(0);
    expect(err.join("\n")).toContain("3");
  });

  it("runs the bare arm with confirmYes, writes grader-ready markdown, logs one line per item, and skips existing responses", async () => {
    const { deps, llmCalls, fakeFs } = makeDeps({ confirmYes: true });
    seedManifestAndCache(fakeFs, [
      { sampleId: "a", prompt: "Prompt A" },
      { sampleId: "b", prompt: "Prompt B" },
      { sampleId: "c", prompt: "Prompt C" },
    ]);
    fakeFs.files.set("benchmarks/research-pilot/responses/bare/a.md", "already here");

    const code = await run(["run", "--arm", "bare"], deps);

    expect(code).toBe(0);
    expect(llmCalls).toHaveLength(2); // n-1: "a" skipped
    expect(fakeFs.files.get("benchmarks/research-pilot/responses/bare/a.md")).toBe("already here");
    expect(fakeFs.files.get("benchmarks/research-pilot/responses/bare/b.md")).toBe("# Fixed Report");
    expect(fakeFs.files.get("benchmarks/research-pilot/responses/bare/c.md")).toBe("# Fixed Report");

    const log = fakeFs.files.get("benchmarks/research-pilot/run-log-bare.jsonl")!;
    const lines = log.trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ sampleId: "b", unverified: [], at: FIXED_NOW });
    expect(typeof lines[0].wordCount).toBe("number");
  });

  it("runs the principles arm with injected runners and records unverified ids in the log", async () => {
    const calls: string[] = [];
    const runners: PrinciplesRunners = {
      generate: async (_llm, objective) => { calls.push(`gen:${objective}`); return { ontology: {} }; },
      run: async (_llm, _ontology, prompt) => { calls.push(`run:${prompt}`); return { answer: "# Answer", unverified: ["agent-s2"] }; },
    };
    const { deps, fakeFs } = makeDeps({ confirmYes: true, runners });
    seedManifestAndCache(fakeFs, [{ sampleId: "x", prompt: "Prompt X" }]);

    const code = await run(["run", "--arm", "principles"], deps);

    expect(code).toBe(0);
    expect(calls).toEqual(["gen:Prompt X", "run:Prompt X"]);
    expect(fakeFs.files.get("benchmarks/research-pilot/responses/principles/x.md")).toBe("# Answer");
    const log = fakeFs.files.get("benchmarks/research-pilot/run-log-principles.jsonl")!;
    const line = JSON.parse(log.trim());
    expect(line).toMatchObject({ sampleId: "x", unverified: ["agent-s2"], at: FIXED_NOW });
  });

  it("run without a manifest errors 2 telling the user to fetch first", async () => {
    const { deps, err } = makeDeps({ confirmYes: true });
    const code = await run(["run", "--arm", "bare"], deps);
    expect(code).toBe(2);
    expect(err.join("\n").toLowerCase()).toContain("fetch first");
  });

  it("non-finite --limit is rejected with exit 2", async () => {
    const { deps, fakeFs } = makeDeps({ confirmYes: true });
    seedManifestAndCache(fakeFs, [{ sampleId: "a", prompt: "Prompt A" }]);
    const code = await run(["run", "--arm", "bare", "--limit", "notanumber"], deps);
    expect(code).toBe(2);
  });
});

describe("research-pilot status", () => {
  it("reports done/total counts per arm", async () => {
    const { deps, out, fakeFs } = makeDeps();
    seedManifestAndCache(fakeFs, [
      { sampleId: "a", prompt: "Prompt A" },
      { sampleId: "b", prompt: "Prompt B" },
      { sampleId: "c", prompt: "Prompt C" },
    ]);
    fakeFs.files.set("benchmarks/research-pilot/responses/bare/a.md", "x");
    fakeFs.files.set("benchmarks/research-pilot/responses/bare/b.md", "x");
    fakeFs.files.set("benchmarks/research-pilot/responses/principles/a.md", "x");

    const code = await run(["status"], deps);

    expect(code).toBe(0);
    const text = out.join("\n");
    expect(text).toContain("bare: 2/3");
    expect(text).toContain("principles: 1/3");
  });
});

describe("research-pilot unknown subcommand", () => {
  it("exits 2", async () => {
    const { deps } = makeDeps();
    const code = await run(["bogus"], deps);
    expect(code).toBe(2);
  });
});
