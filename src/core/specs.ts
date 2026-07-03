import { z } from "zod";
import { Llm } from "../llm/gateway";
import { Truth, Subtask, AgentSpec } from "../shared/types";

const SpecSchema = z.object({
  name: z.string(),
  instructions: z.string(),
  outputHint: z.string(),
});

/**
 * One spec per subtask. Structure (ids, dependencies, truth citations) is
 * derived in code from the subtask graph; only the prose (name, instructions,
 * outputHint) comes from the model.
 */
export async function generateAgentSpecs(
  llm: Llm,
  objective: string,
  truths: Truth[],
  subtasks: Subtask[]
): Promise<AgentSpec[]> {
  const truthById = new Map(truths.map((t) => [t.id, t]));
  const specs: AgentSpec[] = [];

  for (const subtask of subtasks) {
    const served = subtask.servesTruths
      .map((id) => truthById.get(id))
      .filter((t): t is Truth => !!t);

    const prose = await llm({
      system: [
        "You write the working instructions for one specialized text-only agent.",
        "The instructions must be self-contained, specific to the subtask, and",
        "must treat the listed truths as hard constraints the agent may not violate.",
        "outputHint describes the shape and content of what the agent should produce.",
      ].join("\n"),
      prompt: [
        `## Overall objective`,
        objective,
        ``,
        `## This agent's subtask`,
        subtask.description,
        ``,
        `## Truths this agent serves (hard constraints)`,
        ...served.map((t) => `- ${t.id} [${t.type}]: ${t.statement}`),
        ``,
        `## Upstream subtasks whose outputs this agent will receive`,
        ...(subtask.dependsOn.length
          ? subtask.dependsOn.map((d) => `- ${d}: ${subtasks.find((s) => s.id === d)?.description ?? d}`)
          : ["- none"]),
      ].join("\n"),
      schema: SpecSchema,
      schemaName: "agent_spec",
    });

    specs.push({
      id: `agent-${subtask.id}`,
      name: prose.name,
      subtaskId: subtask.id,
      instructions: prose.instructions,
      servesTruths: [...subtask.servesTruths],
      dependsOn: subtask.dependsOn.map((d) => `agent-${d}`),
      outputHint: prose.outputHint,
    });
  }
  return specs;
}
