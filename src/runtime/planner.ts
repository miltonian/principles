import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Ontology, AgentSpec } from "../shared/types";

const PlanSchema = z.object({
  fits: z.boolean(),
  reason: z.string(),
  selectedAgentIds: z.array(z.string()),
});

export interface PlanResult {
  fits: boolean;
  reason: string;
  agents: AgentSpec[];
}

/**
 * Per-prompt triage. The ontology is a decomposition policy, not a mandate:
 * this step decides whether the frame fits THIS prompt, and which agents are
 * actually needed. Dependency closure is computed in code.
 */
export async function plan(llm: Llm, ontology: Ontology, userPrompt: string): Promise<PlanResult> {
  const raw = await llm({
    system: [
      "You decide whether an incoming prompt fits a pre-built agent system, and if so which agents to run.",
      "fits=false when the prompt is outside the system's objective/domain — do not force it.",
      "Select only agents whose subtask contributes to answering THIS prompt.",
    ].join("\n"),
    prompt: [
      `## System objective`,
      ontology.objective,
      ``,
      `## Available agents`,
      ...ontology.agents.map((a) => `- ${a.id}: ${a.name} — ${a.instructions}`),
      ``,
      `## Incoming prompt`,
      userPrompt,
    ].join("\n"),
    schema: PlanSchema,
    schemaName: "triage_plan",
  });

  if (!raw.fits) return { fits: false, reason: raw.reason, agents: [] };

  const byId = new Map(ontology.agents.map((a) => [a.id, a]));
  const selected = new Set<string>();
  const queue = raw.selectedAgentIds.filter((id) => byId.has(id));
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (selected.has(id)) continue;
    selected.add(id);
    queue.push(...byId.get(id)!.dependsOn.filter((d) => byId.has(d)));
  }

  return {
    fits: true,
    reason: raw.reason,
    agents: ontology.agents.filter((a) => selected.has(a.id)), // preserve ontology order
  };
}
