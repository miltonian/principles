import { AgentSpec } from "../shared/types";
import { BlackboardEntry } from "./blackboard";

export interface DeliverableContract {
  genre: string;
  audience: string;
  sections: { title: string; budgetWords: number; agentId: string }[];
  totalBudgetWords: number;
}

/**
 * Extract the first sentence or clause from instructions.
 * Cuts at first "." or ";", then hard-caps at 60 chars.
 */
export function sectionTitle(instructions: string): string {
  const match = instructions.match(/^([^.;]+)[.;]?/);
  const clause = match ? match[1] : instructions;
  return clause.length > 60 ? clause.substring(0, 60) : clause;
}

/**
 * Compute section budget: 40% of result words, clamped to [150, 1200].
 */
export function sectionBudget(resultWords: number): number {
  const budget = Math.round(0.4 * resultWords);
  return Math.max(150, Math.min(1200, budget));
}

/**
 * Build a deliverable contract from selected agents and board entries.
 * Sections are created only for agents that have a corresponding board entry,
 * in the order they appear in specs.
 */
export function buildContract(
  genre: string | undefined,
  audience: string | undefined,
  specs: AgentSpec[],
  entries: BlackboardEntry[]
): DeliverableContract {
  const entryByAgentId = new Map(entries.map((e) => [e.agentId, e]));

  const sections = specs
    .filter((spec) => entryByAgentId.has(spec.id))
    .map((spec) => {
      const entry = entryByAgentId.get(spec.id)!;
      const resultWords = entry.result.split(/\s+/).length;
      return {
        title: sectionTitle(spec.instructions),
        budgetWords: sectionBudget(resultWords),
        agentId: spec.id,
      };
    });

  const totalBudgetWords = sections.reduce((sum, s) => sum + s.budgetWords, 0);

  return {
    genre: genre ?? "comprehensive written response",
    audience: audience ?? "the requester",
    sections,
    totalBudgetWords,
  };
}

/**
 * Render a deliverable contract as an instruction block.
 */
export function renderContract(c: DeliverableContract): string {
  return [
    `You are the author of the finished deliverable: a ${c.genre} for ${c.audience}.`,
    `The answer IS the finished document — a standalone artifact the reader receives cold.`,
    `Never mention agents, subtasks, internal workspaces, or how the work was produced.`,
    `Cover this outline (budgets are minimums to take seriously, not caps):`,
    ...c.sections.map((s) => `- ${s.title} (~${s.budgetWords} words)`),
    `Target at least ${c.totalBudgetWords} words of substantive content overall.`,
    `Any verification caveats or uncertainty belong ONLY in a short closing "Verification notes" section — content first.`,
    `Concrete names, figures, and cited sources from the material are load-bearing — keep them and attribute them. If sources conflict on a name or number, surface the conflict; never silently standardize.`,
    `Respond directly without preamble. Do not start with "Here is" or describe what you are about to do.`,
  ].join("\n");
}
