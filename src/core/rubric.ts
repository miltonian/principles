import { Truth, Criterion } from "../shared/types";

/** The truths ARE the rubric: constraints become criteria the judge must check. */
export function decompositionRubric(truths: Truth[]): Criterion[] {
  const generic: Criterion[] = [
    { id: "d-minimal", source: "generic", description: "Each subtask is a single atomic action that cannot be split further without losing meaning." },
    { id: "d-feasible", source: "generic", description: "Each subtask is achievable by a text-only LLM: analyzing, summarizing, drafting, reasoning. No physical actions, no external systems." },
    { id: "d-complete", source: "generic", description: "The subtasks jointly achieve the full objective; nothing the objective requires is missing." },
  ];
  const fromTruths: Criterion[] = truths
    .filter((t) => t.type === "constraint")
    .map((t) => ({
      id: `d-${t.id}`,
      source: "truth" as const,
      truthId: t.id,
      description: `The decomposition respects the constraint: "${t.statement}"`,
    }));
  return [...generic, ...fromTruths];
}

export function outputRubric(truths: Truth[]): Criterion[] {
  const generic: Criterion[] = [
    { id: "o-responsive", source: "generic", description: "The output directly addresses the user's prompt — not a generic essay near the topic." },
    { id: "o-grounded", source: "generic", description: "The output does not fabricate facts; claims are grounded in the prompt, prior agent outputs, or clearly flagged as uncertain." },
  ];
  const fromTruths: Criterion[] = truths
    .filter((t) => t.type === "constraint")
    .map((t) => ({
      id: `o-${t.id}`,
      source: "truth" as const,
      truthId: t.id,
      description: `The output satisfies the constraint: "${t.statement}"`,
    }));
  return [...generic, ...fromTruths];
}
