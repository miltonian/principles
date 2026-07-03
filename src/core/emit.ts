import fs from "fs-extra";
import path from "path";
import { Ontology } from "../shared/types";
import { GenerationReport } from "./pipeline";

/**
 * Emit a self-contained, DATA-driven package: ontology.json + copied runtime.
 * No code generation, no LLM text interpolated into source files, and the
 * Overview is rendered mechanically from the ontology so it cannot lie.
 */
export function emitPackage(
  baseDir: string,
  report: GenerationReport,
  packagesRoot: string,
  packageName: string
): string {
  const { ontology } = report;
  const pkgDir = path.join(packagesRoot, packageName);
  const srcDir = path.join(pkgDir, "src");
  fs.ensureDirSync(srcDir);

  fs.writeJsonSync(path.join(srcDir, "ontology.json"), ontology, { spaces: 2 });

  for (const dir of ["shared", "llm", "runtime"]) {
    fs.copySync(path.join(baseDir, "src", dir), path.join(srcDir, dir));
  }
  fs.copyFileSync(path.join(baseDir, "tsconfig.json"), path.join(pkgDir, "tsconfig.json"));

  // Mirror dependency versions from the generator's own package.json so
  // emitted packages can never drift from what the generator itself runs.
  const rootPkg = fs.readJsonSync(path.join(baseDir, "package.json"));
  const mirrored = ["@anthropic-ai/claude-agent-sdk", "zod", "zod-to-json-schema", "dotenv"];
  const dependencies = Object.fromEntries(
    mirrored.map((name) => [name, rootPkg.dependencies[name]])
  );

  fs.writeJsonSync(
    path.join(pkgDir, "package.json"),
    {
      name: packageName,
      version: "1.0.0",
      license: "MIT",
      dependencies,
      devDependencies: { typescript: "^5.9.0" },
      scripts: {
        build: "tsc && cp src/ontology.json dist/ontology.json",
        "run-agents": "npm run build && node dist/runtime/main.js",
      },
    },
    { spaces: 2 }
  );

  fs.writeFileSync(path.join(pkgDir, "Overview.md"), renderOverview(ontology, report), "utf8");
  return pkgDir;
}

function renderOverview(ontology: Ontology, report: GenerationReport): string {
  const lines: string[] = [
    `# ${ontology.objective}`,
    ``,
    `Generated agent system. Run with: \`npm run run-agents "<your prompt>"\``,
    ``,
    `## Fundamental truths (vetted)`,
    ...ontology.truths.map((t) => `- **${t.id}** [${t.type}]: ${t.statement}`),
    ``,
    `## Assumptions — Proceeding as if these hold. Correct us if not:`,
    ...(ontology.assumptions.length
      ? ontology.assumptions.map((t) => `- **${t.id}**: ${t.statement}`)
      : ["- (none)"]),
    ``,
    `## Agents`,
    ...ontology.agents.map(
      (a) =>
        `- **${a.id}** (${a.name}): ${a.instructions}\n  - serves: ${a.servesTruths.join(", ")}` +
        (a.dependsOn.length ? `\n  - depends on: ${a.dependsOn.join(", ")}` : "")
    ),
    ``,
    `## Output rubric (every run is judged against this)`,
    ...ontology.outputRubric.map((c) => `- ${c.id}: ${c.description}`),
    ``,
    `## Generation report`,
    `- Decomposition: ${report.decomposition.status} after ${report.decomposition.iterations} iteration(s).`,
    ...(report.vet.rejected.length
      ? [`- Rejected truths:`, ...report.vet.rejected.map((r) => `  - "${r.truth.statement}" — ${r.attack}`)]
      : []),
  ];
  return lines.join("\n") + "\n";
}
