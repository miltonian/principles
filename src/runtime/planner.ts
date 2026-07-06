import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Ontology, AgentSpec } from "../shared/types";

const PlanSchema = z.object({
  fits: z.boolean(),
  reason: z.string(),
  selectedAgentIds: z.array(z.string()),
  deliverableGenre: z.string(),
  deliverableAudience: z.string(),
});

export interface PlanResult {
  fits: boolean;
  reason: string;
  agents: AgentSpec[];
  deliverableGenre?: string;
  deliverableAudience?: string;
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
      "Name the deliverable genre the prompt implies (research report, design document, brief, outline...) and its audience.",
      "If the truths name the deliverable kind or register, adopt that as the genre — do not re-guess.",
    ].join("\n"),
    prompt: [
      `## System objective`,
      ontology.objective,
      ``,
      ...(ontology.truths && ontology.truths.length > 0
        ? [
            `## Truths`,
            ...ontology.truths.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`),
            ``,
          ]
        : []),
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
    deliverableGenre: (raw as { deliverableGenre?: string }).deliverableGenre,
    deliverableAudience: (raw as { deliverableAudience?: string }).deliverableAudience,
  };
}
