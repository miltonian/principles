import { z } from "zod";

export interface LlmRequest<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
}

/** The one and only LLM entry point. Everything model-shaped goes through here. */
export type Llm = <T>(req: LlmRequest<T>) => Promise<T>;
