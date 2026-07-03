import path from "path";
import dotenv from "dotenv";
dotenv.config();
import { execSync } from "child_process";
import fs from "fs";
import { Llm } from "../llm/gateway";
import { makeClaudeAgentSdkLlm } from "../llm/claudeGateway";
import { failures } from "../shared/types";
import { loadRubricCriteria, judgeDiff, renderVerdictTable, COMMENT_MARKER } from "../core/diffJudge";

export interface JudgeDiffDeps {
  llm: Llm;
  exec: (cmd: string) => string;
  readFile: (p: string) => string;
  log: (s: string) => void;
  error: (s: string) => void;
  prNumber?: string;
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

interface Flags { range: string; rubric: string; comment: boolean; strict: boolean; }

function parseArgs(argv: string[]): Flags | { badFlag: string } {
  const flags: Flags = { range: "origin/main...HEAD", rubric: ".github/review-rubric.json", comment: false, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--range") flags.range = argv[++i] ?? flags.range;
    else if (a === "--rubric") flags.rubric = argv[++i] ?? flags.rubric;
    else if (a === "--comment") flags.comment = true;
    else if (a === "--strict") flags.strict = true;
    else return { badFlag: a };
  }
  return flags;
}

function upsertComment(deps: JudgeDiffDeps, body: string): void {
  let prNumber: string;
  if (deps.prNumber && deps.prNumber.trim()) {
    prNumber = deps.prNumber.trim();
  } else {
    try {
      prNumber = deps.exec("gh pr view --json number -q .number").trim();
      if (!prNumber) throw new Error("empty");
    } catch {
      deps.error("No PR context available for --comment; printed table only.");
      return;
    }
  }
  try {
    const existing = deps
      .exec(
        `gh api "repos/{owner}/{repo}/issues/${prNumber}/comments" --jq '[.[] | select(.body | startswith("${COMMENT_MARKER}"))] | first | .id' 2>/dev/null || true`
      )
      .trim();
    if (existing && existing !== "null") {
      deps.exec(`gh api -X PATCH "repos/{owner}/{repo}/issues/comments/${existing}" -f body=${shellQuote(body)}`);
    } else {
      deps.exec(`gh pr comment ${prNumber} --body ${shellQuote(body)}`);
    }
  } catch (e: any) {
    deps.error(`Failed to post PR comment (insufficient permissions on fork PRs is expected): ${e.message}`);
  }
}

export async function run(argv: string[], deps: JudgeDiffDeps): Promise<number> {
  const parsed = parseArgs(argv);
  if ("badFlag" in parsed) {
    deps.error(`Unknown flag: ${parsed.badFlag}. Usage: judge-diff [--range a...b] [--rubric path] [--comment] [--strict]`);
    return 2;
  }

  let rubric;
  try {
    rubric = loadRubricCriteria(JSON.parse(deps.readFile(parsed.rubric)));
  } catch (e: any) {
    deps.error(`Failed to load rubric at ${parsed.rubric}: ${e.message}. Regenerate with: yarn compile-rubric "<goal>" and copy rubric.json there.`);
    return 2;
  }

  let diff: string;
  try {
    diff = deps.exec(`git diff ${parsed.range}`);
  } catch (e: any) {
    deps.error(`git diff failed for range ${parsed.range}: ${e.message}`);
    return 2;
  }
  if (!diff.trim()) {
    deps.log("No changes to judge in the given range.");
    return 0;
  }

  let judgment;
  try {
    judgment = await judgeDiff(deps.llm, diff, rubric);
  } catch (e: any) {
    deps.error(`Judging failed: ${e.message}`);
    return 2;
  }

  const table = renderVerdictTable(judgment);
  deps.log(table);
  if (parsed.comment) upsertComment(deps, table);
  if (parsed.strict && failures(judgment.critique).length > 0) return 1;
  return 0;
}

/* istanbul ignore next -- thin binding, covered by the live gate */
if (require.main === module) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set — relying on local Claude Code credentials if available.");
  }
  const deps: JudgeDiffDeps = {
    llm: makeClaudeAgentSdkLlm(),
    exec: (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }),
    readFile: (p) => fs.readFileSync(path.resolve(p), "utf8"),
    log: console.log,
    error: console.error,
    prNumber: process.env.PR_NUMBER,
  };
  run(process.argv.slice(2), deps).then((code) => process.exit(code));
}
