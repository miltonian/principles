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
    deps.mkdirp(CACHE_DIR);
    deps.writeFile(`${CACHE_DIR}/page-${offset}.json`, text);
    pages.push(text);

    const parsed = JSON.parse(text) as { rows?: unknown[] };
    if (!parsed.rows || parsed.rows.length === 0) break;
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
}

function parseRunFlags(rest: string[]): { arm: Arm; limit?: number } | { badFlag: string } {
  let arm: string | undefined;
  let limit: number | undefined;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--arm") arm = rest[++i];
    else if (a === "--limit") {
      const raw = rest[++i];
      const n = Number(raw);
      if (!Number.isFinite(n)) return { badFlag: `--limit ${raw ?? ""}` };
      limit = n;
    } else return { badFlag: a };
  }
  if (arm !== "bare" && arm !== "principles") return { badFlag: `--arm ${arm ?? "(missing, expected bare|principles)"}` };
  return { arm, limit };
}

async function cmdRun(deps: PilotDeps, rest: string[]): Promise<number> {
  const parsed = parseRunFlags(rest);
  if ("badFlag" in parsed) {
    deps.error(`Unknown or invalid flag: ${parsed.badFlag}. Usage: research-pilot run --arm bare|principles [--limit N] [--yes]`);
    return 2;
  }
  const { arm, limit } = parsed;

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

  let items: ResearchTask[] = manifest.items
    .map((it) => bySampleId.get(it.sampleId))
    .filter((t): t is ResearchTask => t !== undefined);

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

  for (const task of pending) {
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
  }

  return 0;
}

function cmdStatus(deps: PilotDeps): number {
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
  run(argvForRun, deps).then((code) => process.exit(code));
}
