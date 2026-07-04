import { z } from "zod";
import { Llm } from "../llm/gateway";
import { generateOntology } from "../core/pipeline";
import { runOntology } from "../runtime/orchestrator";
import type { ResearchTask } from "./researchLoader";

export interface ArmResponse {
  sampleId: string;
  arm: "bare" | "principles";
  markdown: string;
  wordCount: number;
  unverified: string[];
}

export const BARE_WRAPPER = "Respond with a comprehensive research report in Markdown.";

export async function runBareArm(llm: Llm, task: ResearchTask): Promise<ArmResponse> {
  const schema = z.object({ report: z.string() });
  const response = await llm({
    prompt: `${task.prompt}\n\n${BARE_WRAPPER}`,
    schema,
    schemaName: "bench_report",
    webTools: true,
  });

  return {
    sampleId: task.sampleId,
    arm: "bare",
    markdown: response.report,
    wordCount: response.report.trim().split(/\s+/).length,
    unverified: [],
  };
}

export interface PrinciplesRunners {
  generate(llm: Llm, objective: string): Promise<{ ontology: unknown }>;
  run(llm: Llm, ontology: unknown, prompt: string): Promise<{ answer: string; unverified: string[] }>;
}

export function realRunners(): PrinciplesRunners {
  return {
    generate: generateOntology,
    run: runOntology,
  };
}

export async function runPrinciplesArm(
  llm: Llm,
  task: ResearchTask,
  runners?: PrinciplesRunners
): Promise<ArmResponse> {
  const r = runners ?? realRunners();

  const genResult = await r.generate(llm, task.prompt);
  const runResult = await r.run(llm, genResult.ontology, task.prompt);

  return {
    sampleId: task.sampleId,
    arm: "principles",
    markdown: runResult.answer,
    wordCount: runResult.answer.trim().split(/\s+/).length,
    unverified: runResult.unverified,
  };
}
