import fs from "fs-extra";
import path from "path";
import { CompiledRubric, CompiledCriterion, renderCriteriaForJudging } from "./rubricCompiler";

/** Mechanical rendering from data — cannot hallucinate. */
export function renderRubricMarkdown(rubric: CompiledRubric): string {
  const group = (label: string, items: CompiledCriterion[]) =>
    items.length ? [`## ${label}`, renderCriteriaForJudging(items), ``] : [];

  const lines = [
    `# Rubric: ${rubric.objective}`,
    ``,
    `Attach as the rubric for an outcome-driven agent; a grader marks each criterion pass/fail with cited evidence.`,
    ``,
    ...group("Hard constraints", rubric.criteria.filter((c) => c.source === "truth")),
    ...group("Completeness", rubric.criteria.filter((c) => c.source === "subtask")),
    ...group("General", rubric.criteria.filter((c) => c.source === "generic")),
  ];
  return lines.join("\n").replace(/\n+$/, "\n");
}

export function renderRubricJson(rubric: CompiledRubric): string {
  return JSON.stringify(rubric, null, 2) + "\n";
}

export function slugify(objective: string): string {
  return objective
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function writeRubricArtifacts(
  rubric: CompiledRubric,
  rubricsRoot: string,
  now: () => Date = () => new Date()
): { dir: string; mdPath: string; jsonPath: string } {
  const dir = path.join(rubricsRoot, `${slugify(rubric.objective)}-${now().getTime()}`);
  fs.ensureDirSync(dir);
  const mdPath = path.join(dir, "rubric.md");
  const jsonPath = path.join(dir, "rubric.json");
  fs.writeFileSync(mdPath, renderRubricMarkdown(rubric), "utf8");
  fs.writeFileSync(jsonPath, renderRubricJson(rubric), "utf8");
  return { dir, mdPath, jsonPath };
}
