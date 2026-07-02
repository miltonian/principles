import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { emitPackage } from "../../src/core/emit";
import { GenerationReport } from "../../src/core/pipeline";

const report: GenerationReport = {
  ontology: {
    objective: "evaluate study credibility",
    truths: [{ id: "t1", type: "constraint", statement: "cite evidence", rationale: "r" }],
    assumptions: [{ id: "t2", type: "assumption", statement: "user reads English", rationale: "r" }],
    subtasks: [{ id: "s1", description: "analyze", servesTruths: ["t1"], dependsOn: [] }],
    agents: [{ id: "agent-s1", name: "Analyzer", subtaskId: "s1", instructions: "analyze", servesTruths: ["t1"], dependsOn: [], outputHint: "analysis" }],
    outputRubric: [{ id: "o-responsive", description: "addresses prompt", source: "generic" }],
  },
  vet: { kept: [], assumptions: [], rejected: [] },
  decomposition: { status: "converged", result: [], iterations: 1, history: [] },
};

describe("emitPackage", () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "emit-test-")); });
  afterEach(() => { fs.removeSync(tmp); });

  it("writes ontology.json, runtime sources, package.json, and Overview.md", () => {
    const baseDir = path.join(__dirname, "..", ".."); // repo root
    const pkgDir = emitPackage(baseDir, report, tmp, "test-package");

    const ontology = fs.readJsonSync(path.join(pkgDir, "src", "ontology.json"));
    expect(ontology.objective).toBe("evaluate study credibility");

    expect(fs.existsSync(path.join(pkgDir, "src", "runtime", "orchestrator.ts"))).toBe(true);
    expect(fs.existsSync(path.join(pkgDir, "src", "shared", "types.ts"))).toBe(true);
    expect(fs.existsSync(path.join(pkgDir, "src", "llm", "gateway.ts"))).toBe(true);

    const pkgJson = fs.readJsonSync(path.join(pkgDir, "package.json"));
    expect(pkgJson.scripts["run-agents"]).toBe("npm run build && node dist/runtime/main.js");
    expect(pkgJson.scripts["build"]).toBe("tsc && cp src/ontology.json dist/ontology.json");
    expect(pkgJson.dependencies.zod).toBeDefined();
    expect(pkgJson.dependencies["@anthropic-ai/claude-agent-sdk"]).toBeDefined();
    expect(pkgJson.dependencies["zod-to-json-schema"]).toBeDefined();
    expect(pkgJson.dependencies.openai).toBeUndefined();
    expect(pkgJson.devDependencies.typescript).toBeDefined();

    const overview = fs.readFileSync(path.join(pkgDir, "Overview.md"), "utf8");
    expect(overview).toContain("cite evidence");           // truths rendered
    expect(overview).toContain("Proceeding as if");        // assumptions surfaced
    expect(overview).toContain("agent-s1");                // agents listed
  });
});
