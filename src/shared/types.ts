export type TruthType = "fact" | "assumption" | "constraint" | "definition";

/** A typed, falsifiable claim about the problem domain. */
export interface Truth {
  id: string; // "t1", "t2", ...
  type: TruthType;
  statement: string;
  rationale: string;
  /** Ids of survey Observations this truth cites as evidence (additive; empty/absent = derived by reasoning alone). */
  groundedIn?: string[];
}

export type ObservationKind = "genre-convention" | "topic-axis";

/**
 * A candidate observation from surveying the real-world landscape BEFORE
 * truths are derived. Evidence, not premises: deriveTruths may cite it,
 * the skeptic may reject it exactly like a derived truth.
 */
export interface Observation {
  id: string; // "obs1", "obs2", ...
  kind: ObservationKind;
  statement: string;
  source: string;
}

/** A unit of decomposition. Must cite the truths it serves. */
export interface Subtask {
  id: string; // "s1", "s2", ...
  description: string;
  servesTruths: string[]; // Truth ids
  dependsOn: string[]; // Subtask ids
  /** Model-proposed, judge-verified request for web search/fetch. */
  needsWeb?: boolean;
  webJustification?: string;
}

/**
 * One row of the decomposition's explicit breadth map: a dimension an expert
 * treatment of the topic would cover, either handled by a subtask or
 * explicitly excluded with a reason. Exactly one of handledBy/exclusionReason
 * must be non-empty (see coverage.ts's unmappedBreadth).
 */
export interface CoverageMapRow {
  dimension: string;
  handledBy: string; // subtask id, or "" if excluded
  exclusionReason: string; // non-empty iff excluded
}

/** One evaluation criterion in a rubric. */
export interface Criterion {
  id: string;
  description: string;
  source: "truth" | "generic" | "subtask";
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
  /** Present (true) only when the underlying subtask's web request survived judging. */
  webTools?: boolean;
}

/** The compiled artifact a generated package runs from. */
export interface Ontology {
  objective: string;
  truths: Truth[];
  assumptions: Truth[]; // demoted truths, surfaced to the user
  subtasks: Subtask[];
  agents: AgentSpec[];
  outputRubric: Criterion[];
  /** The decomposition's explicit breadth map (additive — old ontologies unaffected). */
  coverageMap?: CoverageMapRow[];
  /** The landscape survey that grounded truth derivation (additive — old ontologies unaffected). */
  survey?: Observation[];
}
