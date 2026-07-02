import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

export interface LlmRequest<T> {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
}

/** The one and only LLM entry point. Everything model-shaped goes through here. */
export type Llm = <T>(req: LlmRequest<T>) => Promise<T>;

export function makeOpenAiLlm(client: OpenAI, model = "gpt-4o"): Llm {
  return async <T>({ system, prompt, schema, schemaName }: LlmRequest<T>): Promise<T> => {
    const messages = [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      { role: "user" as const, content: prompt },
    ];
    const completion = await client.beta.chat.completions.parse({
      model,
      messages,
      response_format: zodResponseFormat(schema, schemaName),
    });
    const parsed = completion.choices[0]?.message.parsed;
    if (parsed == null) {
      throw new Error(`LLM returned no parsed output for schema "${schemaName}"`);
    }
    return parsed as T;
  };
}
