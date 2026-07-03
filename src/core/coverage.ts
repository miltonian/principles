import { Truth, Subtask, Critique } from "../shared/types";
import { topoLevels } from "../shared/graph";

export function orphanTruths(truths: Truth[], subtasks: Subtask[]): string[] {
  const cited = new Set(subtasks.flatMap((s) => s.servesTruths));
  return truths.filter((t) => !cited.has(t.id)).map((t) => t.id);
}

export function unmooredSubtasks(subtasks: Subtask[]): string[] {
  return subtasks.filter((s) => s.servesTruths.length === 0).map((s) => s.id);
}

export function unknownCitations(truths: Truth[], subtasks: Subtask[]): string[] {
  const known = new Set(truths.map((t) => t.id));
  return [...new Set(subtasks.flatMap((s) => s.servesTruths.filter((id) => !known.has(id))))];
}

export function unknownDependencies(subtasks: Subtask[]): string[] {
  const known = new Set(subtasks.map((s) => s.id));
  return [...new Set(subtasks.flatMap((s) => s.dependsOn.filter((id) => !known.has(id))))];
}

export function hasCycle(subtasks: Subtask[]): boolean {
  return topoLevels(subtasks) === null;
}

export function unjustifiedWeb(subtasks: Subtask[]): string[] {
  return subtasks
    .filter((s) => s.needsWeb === true && !(s.webJustification ?? "").trim())
    .map((s) => s.id);
}

const verdict = (criterionId: string, offenders: string[], passMsg: string) => ({
  criterionId,
  pass: offenders.length === 0,
  evidence: offenders.length === 0 ? passMsg : `Offending ids: ${offenders.join(", ")}`,
});

/**
 * Mechanical critique. Free and deterministic — always run before any LLM judge.
 * An orphan truth is an uncovered requirement; an unmoored subtask is scope creep.
 */
export function coverageCritique(truths: Truth[], subtasks: Subtask[]): Critique {
  return {
    verdicts: [
      verdict("cov-orphan-truths", orphanTruths(truths, subtasks), "every truth is served by a subtask"),
      verdict("cov-unmoored", unmooredSubtasks(subtasks), "every subtask cites a truth"),
      verdict("cov-unknown-citations", unknownCitations(truths, subtasks), "all citations resolve"),
      verdict("cov-unknown-deps", unknownDependencies(subtasks), "all dependencies resolve"),
      verdict("cov-cycle", hasCycle(subtasks) ? ["dependency-cycle"] : [], "dependency graph is acyclic"),
      verdict("cov-web-justified", unjustifiedWeb(subtasks), "every web request carries a justification"),
    ],
  };
}
