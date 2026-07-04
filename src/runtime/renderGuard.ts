import type { DeliverableContract } from "./contract";

/**
 * Result of a render gate check.
 */
export interface GateResult {
  pass: boolean;
  failures: string[];
}

/**
 * Check for internal vocabulary that leaks implementation details.
 * Patterns target PROCESS-CONTEXT phrasings only: reports legitimately ABOUT
 * multi-agent architectures may say "blackboard pattern" or "a synthesis
 * agent aggregates outputs" — those must pass (review-flagged false-positive
 * risk on the pilot's own AI/ML task domains). What must never pass is the
 * run narrating ITSELF: "I'm the synthesis agent", "the blackboard already
 * contains", references to our agent-s<N> ids.
 * Failure message quotes the matched text with ±40 char context.
 */
export function roleLeakGate(text: string): GateResult {
  const patterns = [
    /\b(?:I'?m|I am) the synthesis\b/i,
    /\bas the synthesis agent\b/i,
    /\bmy (?:subtask|blackboard|fellow agents)\b/i,
    /\bagent-s\d+\b/,
    /\b(?:the|our) blackboard (?:already\s+)?(?:contains|has|holds|shows)\b/i,
    // NOTE: no bare topical patterns ("on the blackboard", "blackboard pattern"):
    // reports ABOUT blackboard architectures must pass. The judged
    // c-contract-clean criterion covers narration the regexes can't safely reach.
  ];

  const failures: string[] = [];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const matchIndex = match.index ?? 0;
      const start = Math.max(0, matchIndex - 40);
      const end = Math.min(text.length, matchIndex + match[0].length + 40);
      const context = text.substring(start, end);
      failures.push(`Role leak: "${context}"`);
    }
  }

  return {
    pass: failures.length === 0,
    failures,
  };
}

/**
 * Check that deliverable meets minimum substance threshold (25% of budget).
 * Skip when totalBudgetWords is 0.
 * Failure message names both the word count and the budget.
 */
export function substanceGate(text: string, contract: DeliverableContract): GateResult {
  if (contract.totalBudgetWords === 0) {
    return { pass: true, failures: [] };
  }

  const wordCount = text.split(/\s+/).length;
  const minimum = Math.ceil(0.25 * contract.totalBudgetWords);

  if (wordCount < minimum) {
    const message = `deliverable is ${wordCount} words against a ${contract.totalBudgetWords}-word contract (floor 25%)`;
    return { pass: false, failures: [message] };
  }

  return { pass: true, failures: [] };
}

/**
 * Check for placeholder text: TBD, TODO, [placeholder].
 * Case-sensitive for TBD/TODO (word boundary required).
 * [placeholder] is case-insensitive.
 */
export function placeholderGate(text: string): GateResult {
  const patterns = [/\bTBD\b/, /\bTODO\b/, /\[placeholder\]/i];

  const failures: string[] = [];

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) {
        const matchIndex = match.index ?? 0;
        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(text.length, matchIndex + match[0].length + 40);
        const context = text.substring(start, end);
        failures.push(`Placeholder: "${context}"`);
      }
    }
  }

  return {
    pass: failures.length === 0,
    failures,
  };
}

/**
 * Run all render gates and aggregate their failures.
 */
export function runGates(text: string, contract: DeliverableContract): GateResult {
  const roleResult = roleLeakGate(text);
  const substanceResult = substanceGate(text, contract);
  const placeholderResult = placeholderGate(text);

  const allFailures = [...roleResult.failures, ...substanceResult.failures, ...placeholderResult.failures];

  return {
    pass: allFailures.length === 0,
    failures: allFailures,
  };
}
