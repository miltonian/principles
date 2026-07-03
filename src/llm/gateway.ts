import { z } from "zod";

export interface LlmRequest<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  /** When true, the backing gateway may enable web search/fetch for THIS call only. */
  webTools?: boolean;
}

/** The one and only LLM entry point. Everything model-shaped goes through here. */
export type Llm = <T>(req: LlmRequest<T>) => Promise<T>;
