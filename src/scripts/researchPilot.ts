import path from "path";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import { Llm } from "../llm/gateway";
import { makeClaudeAgentSdkLlm } from "../llm/claudeGateway";
import { parseRowsPages, sampleTasks, buildPilotManifest, ResearchTask, PilotManifest } from "../bench/researchLoader";
import { runBareArm, runPrinciplesArm, PrinciplesRunners } from "../bench/researchArms";

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
const BENCH_DIR = "benchmarks/research-pilot";
const MANIFEST_PATH = `${BENCH_DIR}/manifest.json`;
const RESPONSES_DIR = `${BENCH_DIR}/responses`;
const ARMS = ["bare", "principles"] as const;
type Arm = (typeof ARMS)[number];

const runLogPath = (arm: Arm) => `${BENCH_DIR}/run-log-${arm}.jsonl`;
const pageUrl = (offset: number) =>
  `https://datasets-server.huggingface.co/rows?dataset=ScaleAI%2Fresearchrubrics&config=default&split=train&offset=${offset}&length=100`;

function listResponseFiles(deps: PilotDeps): string[] {
  const found: string[] = [];
  for (const arm of ARMS) {
    const dir = `${RESPONSES_DIR}/${arm}`;
    if (deps.exists(dir)) {
      for (const f of deps.listDir(dir)) found.push(`${dir}/${f}`);
    }
  }
  return found;
}

async function cmdFetch(deps: PilotDeps): Promise<number> {
  try {
    const stale = listResponseFiles(deps);
    if (stale.length > 0) {
      deps.error(
        `Refusing to overwrite ${MANIFEST_PATH}: response file(s) already exist (stale-mixing guard):\n` +
          stale.map((f) => `  - ${f}`).join("\n")
      );
      return 2;
    }

    const pages: string[] = [];
    let offset = 0;
    while (offset < 200) {
      const url = pageUrl(offset);
      const text = await deps.fetchText(url);

      let parsed: { rows?: unknown[] } | undefined;
      try {
        parsed = JSON.parse(text) as { rows?: unknown[] };
      } catch {
        parsed = undefined;
      }
      if (!parsed || !Array.isArray(parsed.rows)) {
        deps.error(`Fetched page at offset ${offset} is not valid JSON with a "rows" array (url: ${url}); nothing cached.`);
        return 2;
      }

      deps.mkdirp(CACHE_DIR);
      deps.writeFile(`${CACHE_DIR}/page-${offset}.json`, text);
      pages.push(text);

      if (parsed.rows.length === 0) break;
      offset += 100;
    }

    const tasks = parseRowsPages(pages);
    const sampled = sampleTasks(tasks, SAMPLE_COUNT, SEED);
    const manifest = buildPilotManifest(sampled, SEED);

    deps.mkdirp(BENCH_DIR);
    deps.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

    deps.log(`Wrote ${MANIFEST_PATH} with ${manifest.count} task(s):`);
    for (const item of manifest.items) {
      deps.log(`  - ${item.sampleId} (${item.rubricCount} rubrics)`);
    }
    return 0;
  } catch (e: any) {
    deps.error(`fetch failed: ${e.message ?? e}`);
    return 2;
  }
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
 * If any item's worker call rejects: in-flight items are allowed to finish, no
 * new items are launched, and the first failure is reported back to the caller.
 */
async function runWorkerPool<T extends { sampleId: string }>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<{ failedSampleId?: string; error?: unknown }> {
  let nextIndex = 0;
  let stopLaunching = false;
  let failedSampleId: string | undefined;
  let error: unknown;

  async function lane(): Promise<void> {
    while (!stopLaunching) {
      const i = nextIndex++;
      if (i >= items.length) return;
      const item = items[i];
      try {
        await worker(item);
      } catch (e) {
        stopLaunching = true;
        failedSampleId = item.sampleId;
        error = e;
        return;
      }
    }
  }

  const laneCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: laneCount }, () => lane()));

  return { failedSampleId, error };
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
      const result = arm === "bare" ? await runBareArm(deps.llm, task) : await runPrinciplesArm(deps.llm, task, deps.runners);

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

    const { failedSampleId, error } = await runWorkerPool(pending, concurrency, runOne);
    if (failedSampleId !== undefined) {
      const message = error instanceof Error ? error.message : String(error);
      deps.error(
        `run failed for arm "${arm}": item "${failedSampleId}" threw (${message}); completed items were persisted and are resumable, remaining items were not started.`
      );
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
      return cmdFetch(deps);
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
