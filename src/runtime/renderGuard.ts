import type { DeliverableContract } from "./contract";
import type { BlackboardEntry } from "./blackboard";

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

// Capitalized 2+-word sequences that are headings/openers, not names — excluded
// even when they otherwise clear the ≥2-occurrence bar (e.g. "Executive Summary"
// repeated as a heading, or "The Analysis" as a sentence-initial fragment).
const NAME_STOPLIST = /^(?:The|This|In|As)\b|^Executive Summary$/;

const RETENTION_MAX_REPORTED = 10;

/**
 * Extract "specifics" (URLs, unit-bearing figures, and repeated proper names)
 * from prior agent output and check that the final deliverable retains them —
 * either verbatim, or named in its closing "Verification notes" section as a
 * deliberate omission. Both cases are satisfied by simple substring containment
 * against the whole deliverable text, since the notes section is part of it.
 *
 * Deterministic and side-effect-free; never throws (a malformed board entry
 * degrades to "nothing extracted from it", not a gate crash that blocks
 * synthesis entirely).
 */
export function retentionGate(deliverable: string, entries: BlackboardEntry[]): GateResult {
  try {
    const URL_RE = /https?:\/\/[^\s)>"']+/g;
    const FIGURE_RE = /\$[\d,.]+[MBk]?|\d+(?:\.\d+)?%|\b\d[\d,]*\s?(?:km|kg|GW|MW|USD|people|deaths|billion|million)\b/g;
    const NAME_RE = /\b[A-Z][a-zA-Z'’-]+(?:\s[A-Z][a-zA-Z'’-]+)+\b/g;

    // text -> the first agentId whose result contributed it (for attribution in failures).
    const specifics = new Map<string, string>();

    for (const entry of entries) {
      const result = entry.result ?? "";
      for (const m of result.matchAll(URL_RE)) {
        if (!specifics.has(m[0])) specifics.set(m[0], entry.agentId);
      }
      for (const m of result.matchAll(FIGURE_RE)) {
        if (!specifics.has(m[0])) specifics.set(m[0], entry.agentId);
      }
    }

    // Names are load-bearing only once they recur across the board (a single
    // passing mention is too weak a signal to force retention on).
    const nameCounts = new Map<string, { count: number; agentId: string }>();
    for (const entry of entries) {
      const result = entry.result ?? "";
      for (const m of result.matchAll(NAME_RE)) {
        const name = m[0];
        if (NAME_STOPLIST.test(name)) continue;
        const existing = nameCounts.get(name);
        if (existing) existing.count += 1;
        else nameCounts.set(name, { count: 1, agentId: entry.agentId });
      }
    }
    for (const [name, info] of nameCounts) {
      if (info.count >= 2 && !specifics.has(name)) specifics.set(name, info.agentId);
    }

    const failures: string[] = [];
    let missingCount = 0;
    for (const [text, agentId] of specifics) {
      if (!deliverable.includes(text)) {
        missingCount += 1;
        if (failures.length < RETENTION_MAX_REPORTED) {
          failures.push(`Retention: "${text}" (from ${agentId}) missing from deliverable and not listed as an omission`);
        }
      }
    }
    if (missingCount > RETENTION_MAX_REPORTED) {
      failures.push(`Retention: ${missingCount - RETENTION_MAX_REPORTED} additional retention failure(s) not shown (quota ${RETENTION_MAX_REPORTED})`);
    }

    return { pass: missingCount === 0, failures };
  } catch {
    // Extraction is best-effort: never let a gate crash block the whole pipeline.
    return { pass: true, failures: [] };
  }
}

/**
 * Run all render gates and aggregate their failures.
 */
export function runGates(text: string, contract: DeliverableContract, entries: BlackboardEntry[]): GateResult {
  const roleResult = roleLeakGate(text);
  const substanceResult = substanceGate(text, contract);
  const placeholderResult = placeholderGate(text);
  const retentionResult = retentionGate(text, entries);

  const allFailures = [
    ...roleResult.failures,
    ...substanceResult.failures,
    ...placeholderResult.failures,
    ...retentionResult.failures,
  ];

  return {
    pass: allFailures.length === 0,
    failures: allFailures,
  };
}
