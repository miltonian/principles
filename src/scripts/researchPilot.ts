import path from "path";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { Llm } from "../llm/gateway";
import { makeClaudeAgentSdkLlm } from "../llm/claudeGateway";
import { parseRowsPages, sampleTasks, buildPilotManifest, ResearchTask, PilotManifest } from "../bench/researchLoader";
import { runBareArm, runPrinciplesArm, realRunners, PrinciplesRunners } from "../bench/researchArms";

export interface PilotDeps {
  llm: Llm;
  fetchText: (url: string) => Promise<string>;
  readFile: (p: string) => string;
  writeFile: (p: string, content: string) => void;
  appendFile: (p: string, content: string) => void;
  exists: (p: string) => boolean;
  mkdirp: (p: string) => void;
  listDir: (p: string) => string[];
  log: (s: string) => void;
  error: (s: string) => void;
  confirmYes: boolean;
  now: () => string;
  runners?: PrinciplesRunners;
}

const SEED = 20260703;
const SAMPLE_COUNT = 10;
const CACHE_DIR = ".bench-cache/researchrubrics";
const ONTOLOGY_CACHE_DIR = ".bench-cache/ontologies";
const BENCH_DIR = "benchmarks/research-pilot";
const MANIFEST_PATH = `${BENCH_DIR}/manifest.json`;
const MANIFEST_HELDOUT_PATH = `${BENCH_DIR}/manifest-heldout.json`;
const RESPONSES_DIR = `${BENCH_DIR}/responses`;
const ARMS = ["bare", "principles"] as const;
type Arm = (typeof ARMS)[number];

const runLogPath = (arm: Arm) => `${BENCH_DIR}/run-log-${arm}.jsonl`;
const pageUrl = (offset: number) =>
  `https://datasets-server.huggingface.co/rows?dataset=ScaleAI%2Fresearchrubrics&config=default&split=train&offset=${offset}&length=100`;

function listResponseFiles(deps: PilotDeps, dirs: string[]): string[] {
  const found: string[] = [];
  for (const dir of dirs) {
    if (deps.exists(dir)) {
      for (const f of deps.listDir(dir)) found.push(`${dir}/${f}`);
    }
  }
  return found;
}

const inSetResponseDirs = () => ARMS.map((arm) => `${RESPONSES_DIR}/${arm}`);
const heldOutResponseDirs = () => ARMS.map((arm) => `${RESPONSES_DIR}/heldout-${arm}`);

function parseFetchFlags(rest: string[]): { seed: number; heldOut: boolean } | { badFlag: string } {
  let seed = SEED;
  let heldOut = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--seed") {
      const raw = rest[++i];
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n)) return { badFlag: `--seed ${raw ?? ""}` };
      seed = n;
    } else if (a === "--held-out") {
      heldOut = true;
    } else return { badFlag: a };
  }
  return { seed, heldOut };
}

async function cmdFetch(deps: PilotDeps, rest: string[]): Promise<number> {
  try {
    const parsed = parseFetchFlags(rest);
    if ("badFlag" in parsed) {
      deps.error(`Unknown or invalid flag: ${parsed.badFlag}. Usage: research-pilot fetch [--seed N] [--held-out]`);
      return 2;
    }
    const { seed, heldOut } = parsed;

    let exclude: Set<string> | undefined;
    const manifestPath = heldOut ? MANIFEST_HELDOUT_PATH : MANIFEST_PATH;

    if (heldOut) {
      if (!deps.exists(MANIFEST_PATH)) {
        deps.error(`No manifest at ${MANIFEST_PATH} — run the in-set fetch first.`);
        return 2;
      }
      const inSetManifest = JSON.parse(deps.readFile(MANIFEST_PATH)) as PilotManifest;
      exclude = new Set(inSetManifest.items.map((it) => it.sampleId));
    }

    const stale = listResponseFiles(deps, heldOut ? heldOutResponseDirs() : inSetResponseDirs());
    if (stale.length > 0) {
      deps.error(
        `Refusing to overwrite ${manifestPath}: response file(s) already exist (stale-mixing guard):\n` +
          stale.map((f) => `  - ${f}`).join("\n")
      );
      return 2;
    }

    const pages: string[] = [];
    let offset = 0;
    while (offset < 200) {
      const url = pageUrl(offset);
      const text = await deps.fetchText(url);

      let parsedPage: { rows?: unknown[] } | undefined;
      try {
        parsedPage = JSON.parse(text) as { rows?: unknown[] };
      } catch {
        parsedPage = undefined;
      }
      if (!parsedPage || !Array.isArray(parsedPage.rows)) {
        deps.error(`Fetched page at offset ${offset} is not valid JSON with a "rows" array (url: ${url}); nothing cached.`);
        return 2;
      }

      deps.mkdirp(CACHE_DIR);
      deps.writeFile(`${CACHE_DIR}/page-${offset}.json`, text);
      pages.push(text);

      if (parsedPage.rows.length === 0) break;
      offset += 100;
    }

    const tasks = parseRowsPages(pages);
    const sampled = sampleTasks(tasks, SAMPLE_COUNT, seed, exclude);
    const manifest = buildPilotManifest(sampled, seed);

    deps.mkdirp(BENCH_DIR);
    deps.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    deps.log(`Wrote ${manifestPath} with ${manifest.count} task(s):`);
    for (const item of manifest.items) {
      deps.log(`  - ${item.sampleId} (${item.rubricCount} rubrics)`);
    }
    return 0;
  } catch (e: any) {
    deps.error(`fetch failed: ${e.message ?? e}`);
    return 2;
  }
}

/**
 * Wraps a PrinciplesRunners so that, per task, a previously-generated ontology
 * is reused across resumed runs instead of re-generated: before generating, if
 * `.bench-cache/ontologies/<sampleId>.json` exists and parses, it is returned
 * as-is (base.generate is not called). Otherwise base.generate runs and its
 * result is persisted. A malformed cache file is treated as absent (regenerate
 * and overwrite) rather than crashing the run.
 */
function withOntologyPersistence(base: PrinciplesRunners, deps: PilotDeps, sampleId: string): PrinciplesRunners {
  const cachePath = `${ONTOLOGY_CACHE_DIR}/${sampleId}.json`;
  return {
    generate: async (llm, objective) => {
      if (deps.exists(cachePath)) {
        try {
          return { ontology: JSON.parse(deps.readFile(cachePath)) };
        } catch {
          // malformed persisted ontology — fall through and regenerate below
        }
      }
      const result = await base.generate(llm, objective);
      deps.mkdirp(ONTOLOGY_CACHE_DIR);
      deps.writeFile(cachePath, JSON.stringify(result.ontology, null, 2));
      return result;
    },
    run: base.run,
  };
}

const MAX_CONCURRENCY = 4;

function parseRunFlags(rest: string[]): { arm: Arm; limit?: number; concurrency?: number } | { badFlag: string } {
  let arm: string | undefined;
  let limit: number | undefined;
  let concurrency: number | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--arm") arm = rest[++i];
    else if (a === "--limit") {
      const raw = rest[++i];
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return { badFlag: `--limit ${raw ?? ""}` };
      limit = n;
    } else if (a === "--concurrency") {
      const raw = rest[++i];
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return { badFlag: `--concurrency ${raw ?? ""}` };
      concurrency = n;
    } else return { badFlag: a };
  }
  if (arm !== "bare" && arm !== "principles") return { badFlag: `--arm ${arm ?? "(missing, expected bare|principles)"}` };
  return { arm, limit, concurrency };
}

/**
 * Runs `items` through `worker`, at most `concurrency` in flight at once.
 * Per-item failures are recorded and SKIPPED — remaining items still run.
 * Live evidence forced this: the SDK's structured-output flake arrives in
 * bursts that beat any per-call retry budget; fail-fast turned one bad item
 * into a dead multi-hour run, three times. Failed items stay resumable (no
 * response file is written), and every failure is reported at the end.
 */
async function runWorkerPool<T extends { sampleId: string }>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<{ failures: { sampleId: string; error: unknown }[] }> {
  let nextIndex = 0;
  const failures: { sampleId: string; error: unknown }[] = [];

  async function lane(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      const item = items[i];
      try {
        await worker(item);
      } catch (e) {
        failures.push({ sampleId: item.sampleId, error: e });
      }
    }
  }

  const laneCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: laneCount }, () => lane()));

  return { failures };
}

async function cmdRun(deps: PilotDeps, rest: string[]): Promise<number> {
  try {
    const parsed = parseRunFlags(rest);
    if ("badFlag" in parsed) {
      deps.error(
        `Unknown or invalid flag: ${parsed.badFlag}. Usage: research-pilot run --arm bare|principles [--limit N] [--concurrency N] [--yes]`
      );
      return 2;
    }
    const { arm, limit } = parsed;
    let concurrency = parsed.concurrency ?? 1;
    if (concurrency > MAX_CONCURRENCY) {
      deps.log(`Requested --concurrency ${concurrency} exceeds the max of ${MAX_CONCURRENCY}; clamping to ${MAX_CONCURRENCY}.`);
      concurrency = MAX_CONCURRENCY;
    }

    if (!deps.exists(MANIFEST_PATH)) {
      deps.error(`No manifest at ${MANIFEST_PATH} — run fetch first.`);
      return 2;
    }
    if (!deps.exists(CACHE_DIR)) {
      deps.error(`No cached dataset pages at ${CACHE_DIR} — run fetch first.`);
      return 2;
    }

    const manifest = JSON.parse(deps.readFile(MANIFEST_PATH)) as PilotManifest;
    const pageFiles = deps.listDir(CACHE_DIR).filter((f) => f.endsWith(".json"));
    const pageTexts = pageFiles.map((f) => deps.readFile(`${CACHE_DIR}/${f}`));
    const allTasks = parseRowsPages(pageTexts);
    const bySampleId = new Map(allTasks.map((t) => [t.sampleId, t]));

    const missingIds = manifest.items.filter((it) => !bySampleId.has(it.sampleId)).map((it) => it.sampleId);
    if (missingIds.length > 0) {
      deps.error(
        `Manifest sample id(s) not found in cached pages at ${CACHE_DIR}: ${missingIds.join(", ")}. Run \`research-pilot fetch\` to refresh the cache.`
      );
      return 2;
    }

    let items: ResearchTask[] = manifest.items.map((it) => bySampleId.get(it.sampleId) as ResearchTask);

    if (limit !== undefined) items = items.slice(0, limit);

    const responsesDir = `${RESPONSES_DIR}/${arm}`;
    const pending = items.filter((t) => !deps.exists(`${responsesDir}/${t.sampleId}.md`));

    if (pending.length === 0) {
      deps.log(`Nothing to run for arm "${arm}" — all ${items.length} item(s) already have responses.`);
      return 0;
    }

    if (!deps.confirmYes) {
      deps.error(
        `This will invoke the LLM ${pending.length} time(s) for arm "${arm}" (of ${items.length} total item(s)). Re-run with --yes to confirm.`
      );
      return 2;
    }

    deps.mkdirp(responsesDir);
    deps.mkdirp(BENCH_DIR);

    const runOne = async (task: ResearchTask): Promise<void> => {
      const result =
        arm === "bare"
          ? await runBareArm(deps.llm, task)
          : await runPrinciplesArm(
              deps.llm,
              task,
              withOntologyPersistence(deps.runners ?? realRunners(), deps, task.sampleId)
            );

      deps.writeFile(`${responsesDir}/${task.sampleId}.md`, result.markdown);
      deps.appendFile(
        runLogPath(arm),
        `${JSON.stringify({ sampleId: task.sampleId, wordCount: result.wordCount, unverified: result.unverified, at: deps.now() })}\n`
      );
      deps.log(
        `[${arm}] ${task.sampleId} — ${result.wordCount} words, unverified: ${
          result.unverified.length ? result.unverified.join(", ") : "none"
        }`
      );
    };

    const { failures } = await runWorkerPool(pending, concurrency, runOne);
    if (failures.length > 0) {
      for (const f of failures) {
        const message = f.error instanceof Error ? f.error.message : String(f.error);
        deps.error(`run failed for arm "${arm}": item "${f.sampleId}" threw (${message}); it remains resumable.`);
      }
      deps.error(`${failures.length} item(s) failed; ${pending.length - failures.length} completed. Re-run to retry the failures.`);
      return 2;
    }

    return 0;
  } catch (e: any) {
    deps.error(`run failed: ${e.message ?? e}`);
    return 2;
  }
}

function cmdStatus(deps: PilotDeps): number {
  try {
    if (!deps.exists(MANIFEST_PATH)) {
      deps.error(`No manifest at ${MANIFEST_PATH} — run fetch first.`);
      return 2;
    }
    const manifest = JSON.parse(deps.readFile(MANIFEST_PATH)) as PilotManifest;
    for (const arm of ARMS) {
      const dir = `${RESPONSES_DIR}/${arm}`;
      const done = manifest.items.filter((it) => deps.exists(`${dir}/${it.sampleId}.md`)).length;
      deps.log(`${arm}: ${done}/${manifest.count}`);
    }
    return 0;
  } catch (e: any) {
    deps.error(`status failed: ${e.message ?? e}`);
    return 2;
  }
}

export async function run(argv: string[], deps: PilotDeps): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "fetch":
      return cmdFetch(deps, rest);
    case "run":
      return cmdRun(deps, rest);
    case "status":
      return cmdStatus(deps);
    default:
      deps.error(`Unknown subcommand: ${cmd ?? "(none)"}. Usage: research-pilot fetch|run --arm bare|principles [--limit N] [--yes]|status`);
      return 2;
  }
}

/* istanbul ignore next -- thin binding, covered by the live gate */
if (require.main === module) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set — relying on local Claude Code credentials if available.");
  }
  const rawArgv = process.argv.slice(2);
  const confirmYes = rawArgv.includes("--yes");
  const argvForRun = rawArgv.filter((a) => a !== "--yes");

  const deps: PilotDeps = {
    llm: makeClaudeAgentSdkLlm(),
    fetchText: async (url) => {
      const res = await fetch(url);
      return res.text();
    },
    readFile: (p) => fs.readFileSync(path.resolve(p), "utf8"),
    writeFile: (p, content) => fs.writeFileSync(path.resolve(p), content),
    appendFile: (p, content) => fs.appendFileSync(path.resolve(p), content),
    exists: (p) => fs.existsSync(path.resolve(p)),
    mkdirp: (p) => fs.mkdirSync(path.resolve(p), { recursive: true }),
    listDir: (p) => fs.readdirSync(path.resolve(p)),
    log: console.log,
    error: console.error,
    confirmYes,
    now: () => new Date().toISOString(),
  };
  run(argvForRun, deps)
    .then((code) => process.exit(code))
    .catch(() => process.exit(2));
}
