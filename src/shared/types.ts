export type TruthType = "fact" | "assumption" | "constraint" | "definition";

/** A typed, falsifiable claim about the problem domain. */
export interface Truth {
  id: string; // "t1", "t2", ...
  type: TruthType;
  statement: string;
  rationale: string;
}

/** A unit of decomposition. Must cite the truths it serves. */
export interface Subtask {
  id: string; // "s1", "s2", ...
  description: string;
  servesTruths: string[]; // Truth ids
  dependsOn: string[]; // Subtask ids
}

/** One evaluation criterion in a rubric. */
export interface Criterion {
  id: string;
  description: string;
  source: "truth" | "generic";
  truthId?: string; // set when source === "truth"
}

/** A judge's verdict on one criterion. Evidence is mandatory. */
export interface CriterionVerdict {
  criterionId: string;
  pass: boolean;
  evidence: string;
}

export interface Critique {
  verdicts: CriterionVerdict[];
}

export const failures = (c: Critique): CriterionVerdict[] =>
  c.verdicts.filter((v) => !v.pass);

/** Runtime-executable agent specification. Pure data — no code. */
export interface AgentSpec {
  id: string; // "agent-s1", ...
  name: string;
  subtaskId: string;
  instructions: string;
  servesTruths: string[];
  dependsOn: string[]; // AgentSpec ids
  outputHint: string;
}

/** The compiled artifact a generated package runs from. */
export interface Ontology {
  objective: string;
  truths: Truth[];
  assumptions: Truth[]; // demoted truths, surfaced to the user
  subtasks: Subtask[];
  agents: AgentSpec[];
  outputRubric: Criterion[];
}
