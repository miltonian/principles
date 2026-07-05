import { describe, it, expect } from "vitest";
import { run, PilotDeps } from "../../src/scripts/researchPilot";
import { Llm } from "../../src/llm/gateway";
import { PrinciplesRunners } from "../../src/bench/researchArms";

const page = (rows: unknown[]) => JSON.stringify({ rows: rows.map((row) => ({ row })) });

const FIXED_NOW = "2026-07-03T00:00:00.000Z";

/** Flush pending microtasks/macrotasks so deferred-promise fakes can advance one step. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

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

  it("a fetchText that throws (network error) is caught and returns 2 with the error logged, not a rejection", async () => {
    const { deps, err } = makeDeps({
      fetchText: async () => {
        throw new Error("ECONNRESET");
      },
    });

    const code = await run(["fetch"], deps);

    expect(code).toBe(2);
    expect(err.join("\n")).toContain("ECONNRESET");
  });

  it("a non-JSON/rows-less fetched page exits 2 without caching anything", async () => {
    const { deps, fakeFs } = makeDeps({ fetchText: async () => "<html>oops</html>" });

    const code = await run(["fetch"], deps);

    expect(code).toBe(2);
    expect([...fakeFs.files.keys()].some((f) => f.startsWith(".bench-cache/"))).toBe(false);
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

  describe("principles arm ontology persistence", () => {
    it("persists the freshly generated ontology to .bench-cache/ontologies/<sampleId>.json", async () => {
      const calls: string[] = [];
      const runners: PrinciplesRunners = {
        generate: async (_llm, objective) => {
          calls.push(`gen:${objective}`);
          return { ontology: { objective, marker: "fresh" } };
        },
        run: async (_llm, _ontology, prompt) => {
          calls.push(`run:${prompt}`);
          return { answer: "# Answer", unverified: [] };
        },
      };
      const { deps, fakeFs } = makeDeps({ confirmYes: true, runners });
      seedManifestAndCache(fakeFs, [{ sampleId: "x", prompt: "Prompt X" }]);

      const code = await run(["run", "--arm", "principles"], deps);

      expect(code).toBe(0);
      expect(calls).toEqual(["gen:Prompt X", "run:Prompt X"]);
      const cached = JSON.parse(fakeFs.files.get(".bench-cache/ontologies/x.json")!);
      expect(cached).toEqual({ objective: "Prompt X", marker: "fresh" });
    });

    it("resuming with a persisted ontology skips generate and passes the persisted object to run", async () => {
      const calls: Array<{ fn: string; arg?: unknown }> = [];
      const runners: PrinciplesRunners = {
        generate: async () => {
          calls.push({ fn: "generate" });
          return { ontology: { should: "not-happen" } };
        },
        run: async (_llm, ontology) => {
          calls.push({ fn: "run", arg: ontology });
          return { answer: "# Answer", unverified: [] };
        },
      };
      const { deps, fakeFs } = makeDeps({ confirmYes: true, runners });
      seedManifestAndCache(fakeFs, [{ sampleId: "x", prompt: "Prompt X" }]);
      const persisted = { objective: "Prompt X", marker: "persisted" };
      fakeFs.mkdirp(".bench-cache/ontologies");
      fakeFs.files.set(".bench-cache/ontologies/x.json", JSON.stringify(persisted));

      const code = await run(["run", "--arm", "principles"], deps);

      expect(code).toBe(0);
      expect(calls.filter((c) => c.fn === "generate")).toHaveLength(0);
      expect(calls).toContainEqual({ fn: "run", arg: persisted });
    });

    it("a malformed persisted ontology file is regenerated (no crash) and the cache is overwritten", async () => {
      const calls: string[] = [];
      const runners: PrinciplesRunners = {
        generate: async (_llm, objective) => {
          calls.push("generate");
          return { ontology: { objective, marker: "regenerated" } };
        },
        run: async () => {
          calls.push("run");
          return { answer: "# Answer", unverified: [] };
        },
      };
      const { deps, fakeFs } = makeDeps({ confirmYes: true, runners });
      seedManifestAndCache(fakeFs, [{ sampleId: "x", prompt: "Prompt X" }]);
      fakeFs.mkdirp(".bench-cache/ontologies");
      fakeFs.files.set(".bench-cache/ontologies/x.json", "{not valid json");

      const code = await run(["run", "--arm", "principles"], deps);

      expect(code).toBe(0);
      expect(calls).toEqual(["generate", "run"]);
      const cached = JSON.parse(fakeFs.files.get(".bench-cache/ontologies/x.json")!);
      expect(cached).toEqual({ objective: "Prompt X", marker: "regenerated" });
    });
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

  it("negative --limit is rejected with exit 2", async () => {
    const { deps, fakeFs } = makeDeps({ confirmYes: true });
    seedManifestAndCache(fakeFs, [{ sampleId: "a", prompt: "Prompt A" }]);
    const code = await run(["run", "--arm", "bare", "--limit", "-1"], deps);
    expect(code).toBe(2);
  });

  it("errors 2 when a manifest sample id is missing from cached pages, naming it, invoking no arm", async () => {
    const { deps, err, llmCalls, fakeFs } = makeDeps({ confirmYes: true });
    seedManifestAndCache(fakeFs, [
      { sampleId: "a", prompt: "Prompt A" },
      { sampleId: "b", prompt: "Prompt B" },
    ]);
    const manifest = JSON.parse(fakeFs.files.get("benchmarks/research-pilot/manifest.json")!);
    manifest.items.push({ sampleId: "missing-id", rubricCount: 1 });
    manifest.count = manifest.items.length;
    fakeFs.files.set("benchmarks/research-pilot/manifest.json", JSON.stringify(manifest));

    const code = await run(["run", "--arm", "bare"], deps);

    expect(code).toBe(2);
    expect(llmCalls).toHaveLength(0);
    expect(err.join("\n")).toContain("missing-id");
  });

  it("errors 2 (not 0) when the cache dir exists but is empty, even though a manifest exists", async () => {
    const { deps, llmCalls, fakeFs } = makeDeps({ confirmYes: true });
    const manifest = {
      dataset: "ScaleAI/researchrubrics",
      seed: 20260703,
      count: 1,
      items: [{ sampleId: "a", rubricCount: 1 }],
    };
    fakeFs.files.set("benchmarks/research-pilot/manifest.json", JSON.stringify(manifest));
    fakeFs.dirs.add(".bench-cache/researchrubrics"); // exists but has no cached page files

    const code = await run(["run", "--arm", "bare"], deps);

    expect(code).toBe(2);
    expect(llmCalls).toHaveLength(0);
  });

  describe("--concurrency", () => {
    /** A controllable fake LLM whose calls pause on a deferred promise until released, tracking in-flight count. */
    function makeDeferredLlm() {
      let inFlight = 0;
      let maxInFlight = 0;
      const releases: Array<() => void> = [];
      const llm: Llm = (async (req: any) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((resolve) => releases.push(resolve));
        inFlight--;
        return { report: `# ${req.prompt}` };
      }) as unknown as Llm;
      return { llm, releases, getMaxInFlight: () => maxInFlight };
    }

    it("--concurrency 2 runs at most two items in flight simultaneously, writes all responses, one log line each", async () => {
      const { llm, releases, getMaxInFlight } = makeDeferredLlm();
      const { deps, fakeFs } = makeDeps({ confirmYes: true, llm });
      seedManifestAndCache(fakeFs, [
        { sampleId: "a", prompt: "Prompt A" },
        { sampleId: "b", prompt: "Prompt B" },
        { sampleId: "c", prompt: "Prompt C" },
        { sampleId: "d", prompt: "Prompt D" },
      ]);

      const runPromise = run(["run", "--arm", "bare", "--concurrency", "2"], deps);

      await flush();
      expect(releases.length).toBe(2); // exactly two in flight at first wave

      while (releases.length > 0) {
        releases.shift()!();
        await flush();
      }

      const code = await runPromise;

      expect(code).toBe(0);
      expect(getMaxInFlight()).toBe(2);
      for (const id of ["a", "b", "c", "d"]) {
        expect(fakeFs.files.has(`benchmarks/research-pilot/responses/bare/${id}.md`)).toBe(true);
      }
      const log = fakeFs.files.get("benchmarks/research-pilot/run-log-bare.jsonl")!;
      expect(log.trim().split("\n")).toHaveLength(4);
    });

    it("defaults to concurrency 1 (sequential): only one item in flight at a time", async () => {
      const { llm, releases, getMaxInFlight } = makeDeferredLlm();
      const { deps, fakeFs } = makeDeps({ confirmYes: true, llm });
      seedManifestAndCache(fakeFs, [
        { sampleId: "a", prompt: "Prompt A" },
        { sampleId: "b", prompt: "Prompt B" },
        { sampleId: "c", prompt: "Prompt C" },
      ]);

      const runPromise = run(["run", "--arm", "bare"], deps);

      await flush();
      expect(releases.length).toBe(1);

      while (releases.length > 0) {
        releases.shift()!();
        await flush();
      }

      const code = await runPromise;
      expect(code).toBe(0);
      expect(getMaxInFlight()).toBe(1);
    });

    it("--concurrency 0 is rejected with exit 2", async () => {
      const { deps, fakeFs } = makeDeps({ confirmYes: true });
      seedManifestAndCache(fakeFs, [{ sampleId: "a", prompt: "Prompt A" }]);
      const code = await run(["run", "--arm", "bare", "--concurrency", "0"], deps);
      expect(code).toBe(2);
    });

    it("non-finite --concurrency is rejected with exit 2", async () => {
      const { deps, fakeFs } = makeDeps({ confirmYes: true });
      seedManifestAndCache(fakeFs, [{ sampleId: "a", prompt: "Prompt A" }]);
      const code = await run(["run", "--arm", "bare", "--concurrency", "notanumber"], deps);
      expect(code).toBe(2);
    });

    it("clamps a requested concurrency above 4 down to 4, logging a note", async () => {
      const { llm, releases, getMaxInFlight } = makeDeferredLlm();
      const { deps, out, fakeFs } = makeDeps({ confirmYes: true, llm });
      seedManifestAndCache(
        fakeFs,
        Array.from({ length: 6 }, (_, i) => ({ sampleId: `s${i}`, prompt: `Prompt ${i}` }))
      );

      const runPromise = run(["run", "--arm", "bare", "--concurrency", "10"], deps);

      await flush();
      expect(releases.length).toBe(4); // clamped to max 4, not 10

      while (releases.length > 0) {
        releases.shift()!();
        await flush();
      }

      const code = await runPromise;
      expect(code).toBe(0);
      expect(getMaxInFlight()).toBe(4);
      expect(out.some((l) => l.includes("10") && l.includes("4"))).toBe(true);
    });

    it("skips a failing item, still runs the rest, exits 2 naming the failure (skip-and-continue; supersedes fail-fast)", async () => {
      const callOrder: string[] = [];
      let releaseA: () => void = () => {};
      const llm: Llm = (async (req: any) => {
        const prompt = req.prompt as string;
        callOrder.push(prompt);
        if (prompt.startsWith("Prompt B")) throw new Error("boom-b");
        if (prompt.startsWith("Prompt A")) {
          await new Promise<void>((resolve) => {
            releaseA = resolve;
          });
        }
        return { report: `# ${prompt}` };
      }) as unknown as Llm;

      const { deps, err, fakeFs } = makeDeps({ confirmYes: true, llm });
      seedManifestAndCache(fakeFs, [
        { sampleId: "a", prompt: "Prompt A" },
        { sampleId: "b", prompt: "Prompt B" },
        { sampleId: "c", prompt: "Prompt C" },
        { sampleId: "d", prompt: "Prompt D" },
      ]);

      const runPromise = run(["run", "--arm", "bare", "--concurrency", "2"], deps);

      await flush(); // let "a" start (deferred) and "b" fail

      releaseA();
      await flush();

      const code = await runPromise;

      expect(code).toBe(2);
      expect(err.join("\n")).toContain("b");
      // Skip-and-continue semantics (supersedes fail-fast): the failing item is
      // reported and left resumable; every OTHER item still completes.
      expect(fakeFs.files.has("benchmarks/research-pilot/responses/bare/a.md")).toBe(true);
      expect(fakeFs.files.has("benchmarks/research-pilot/responses/bare/b.md")).toBe(false);
      expect(fakeFs.files.has("benchmarks/research-pilot/responses/bare/c.md")).toBe(true);
      expect(fakeFs.files.has("benchmarks/research-pilot/responses/bare/d.md")).toBe(true);
      expect(callOrder.some((p) => p.startsWith("Prompt C"))).toBe(true);
      expect(callOrder.some((p) => p.startsWith("Prompt D"))).toBe(true);
    });
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

describe("worker pool — skip-and-continue on item failure (live: SDK flake bursts killed multi-hour runs)", () => {
  it("a failing item is recorded but later items still run; exit 2 names the failure", async () => {
    const { deps, err, fakeFs } = makeDeps({ confirmYes: true });
    seedManifestAndCache(fakeFs, [
      { sampleId: "a", prompt: "Prompt A" },
      { sampleId: "b", prompt: "Prompt B" },
      { sampleId: "c", prompt: "Prompt C" },
    ]);
    const ran: string[] = [];
    deps.runners = {
      generate: async () => ({ ontology: { o: 1 } }),
      run: async (_l: unknown, _o: unknown, prompt: string) => {
        const id = prompt.includes("Prompt A") ? "a" : prompt.includes("Prompt B") ? "b" : "c";
        ran.push(id);
        if (id === "b") throw new Error("SDK finalize flake");
        return { answer: "# Report body", unverified: [], discoveries: [] };
      },
    } as never;

    const code = await run(["run", "--arm", "principles"], deps);

    expect(code).toBe(2);                                   // failure still surfaces
    expect(ran.sort()).toEqual(["a", "b", "c"]);            // c RAN despite b failing
    expect(fakeFs.files.has("benchmarks/research-pilot/responses/principles/a.md")).toBe(true);
    expect(fakeFs.files.has("benchmarks/research-pilot/responses/principles/c.md")).toBe(true);
    expect(fakeFs.files.has("benchmarks/research-pilot/responses/principles/b.md")).toBe(false);
    expect(err.join(" ")).toContain('"b"');
  });
});
