import { Critique, failures } from "./types";

export interface RefineFeedback<T> {
  previous: T;
  critique: Critique;
}

export type RefineOutcome<T> =
  | { status: "converged"; result: T; iterations: number; history: Critique[] }
  | { status: "escalated"; result: T; iterations: number; history: Critique[]; stuckOn: string[] }
  | { status: "exhausted"; result: T; iterations: number; history: Critique[] };

/**
 * Revision loop with memory. Termination is a fixed point of the critique,
 * not an iteration count: we stop when nothing fails (converged), when the
 * same criterion fails twice consecutively (escalated — the reviser cannot
 * fix it, so looping again is a re-roll), or at maxIterations (exhausted).
 */
export async function refine<T>(
  produce: (feedback: RefineFeedback<T> | null) => Promise<T>,
  judgeFn: (candidate: T) => Promise<Critique>,
  opts: { maxIterations?: number } = {}
): Promise<RefineOutcome<T>> {
  const maxIterations = opts.maxIterations ?? 5;
  const history: Critique[] = [];
  let feedback: RefineFeedback<T> | null = null;
  let candidate!: T;

  for (let i = 1; i <= maxIterations; i++) {
    candidate = await produce(feedback);
    const critique = await judgeFn(candidate);
    history.push(critique);

    const failed = failures(critique).map((v) => v.criterionId);
    if (failed.length === 0) {
      return { status: "converged", result: candidate, iterations: i, history };
    }

    const previousFailed = history.length > 1
      ? new Set(failures(history[history.length - 2]).map((v) => v.criterionId))
      : new Set<string>();
    const stuckOn = failed.filter((id) => previousFailed.has(id));
    if (stuckOn.length > 0) {
      return { status: "escalated", result: candidate, iterations: i, history, stuckOn };
    }

    feedback = { previous: candidate, critique };
  }
  return { status: "exhausted", result: candidate, iterations: maxIterations, history };
}
