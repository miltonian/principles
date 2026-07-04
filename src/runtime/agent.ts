import { z } from "zod";
import { Llm } from "../llm/gateway";
import { AgentSpec } from "../shared/types";
import { Blackboard } from "./blackboard";

// notes is optional at the schema level: live runs on research-scale tasks showed
// the SDK's structured-output finalize failing all 5 internal attempts when the
// model couldn't fit two report-sized strings in one payload — it emitted exactly
// one field per attempt. result is the deliverable; notes must never block it.
const AgentOutputSchema = z.object({
  notes: z.string().optional(),
  result: z.string(),
});

export interface AgentOutput {
  notes: string;
  result: string;
}

/** One agent = one LLM call over the spec, the user prompt, and the full blackboard. */
export async function runAgent(
  llm: Llm,
  spec: AgentSpec,
  userPrompt: string,
  board: Blackboard,
  improvementNotes?: string
): Promise<AgentOutput> {
  const out = await llm({
    system: [
      `You are "${spec.name}", a specialized text-only agent.`,
      `Your subtask: ${spec.instructions}`,
      `Hard constraints (truths you serve): ${spec.servesTruths.join(", ")}`,
      `Produce:`,
      `- result: your deliverable. Expected shape: ${spec.outputHint}`,
      `- notes: reasoning, caveats, and nuance that downstream agents need. Do not repeat the result here. Keep notes under 200 words; if space is tight, result takes priority.`,
      ...(spec.webTools
        ? [`You may use web search and web fetch for this subtask. Cite the URLs you used in your notes.`]
        : []),
    ].join("\n"),
    prompt: [
      `## User prompt`,
      userPrompt,
      ``,
      `## Blackboard (everything produced so far — read it all, build on it, do not contradict it silently)`,
      board.render(),
      ...(improvementNotes
        ? [``, `## Your previous attempt was judged insufficient — fix exactly this`, improvementNotes]
        : []),
    ].join("\n"),
    schema: AgentOutputSchema,
    schemaName: "agent_output",
    ...(spec.webTools ? { webTools: true } : {}),
  });
  return { result: out.result, notes: out.notes ?? "" };
}
