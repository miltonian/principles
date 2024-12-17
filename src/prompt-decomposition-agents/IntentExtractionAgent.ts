// src/agents/IntentExtractionAgent.ts

import { sendMessageToChatGPT } from "../llms/openaiClient";
import { cleanOpenAIResponse } from "../utils/responseUtils";
import { IntentOutput } from "./types";

export class IntentExtractionAgent {
  async processPrompt(userPrompt: string): Promise<IntentOutput> {
    if (!userPrompt?.trim()) {
      return { status: "error", errorMessage: "Empty prompt" };
    }

    const systemPrompt = `
You are a specialized assistant whose sole task is to extract the user's primary intent and any key parameters from their prompt.
You MUST:
- Return ONLY JSON in the format: {"intent":"...", "parameters":{...}}.
- If no parameters, use an empty object for "parameters".
- Do not include extra text outside the JSON.
- The "intent" should be a concise summary of the user's main goal.
- The "parameters" should capture any explicit constraints (like timeframe, domain, etc.) mentioned by the user.
`;

    const userMessage = `
User prompt: "${userPrompt}"

Extract the intent and parameters now.
`;

    const response = cleanOpenAIResponse(await sendMessageToChatGPT({
        messages: [
          {
            role: "user",
            content: `
                  ## Instructions
                  ${systemPrompt}
  
                  ${userMessage}
              `,
          },
        ],
      }));

    try {
      const data = JSON.parse(response);
      if (typeof data.intent === "string") {
        return { status: "success", intent: data.intent, parameters: data.parameters || {} };
      } else {
        return { status: "error", errorMessage: "No 'intent' found in the response." };
      }
    } catch {
      return { status: "error", errorMessage: "Failed to parse intent JSON." };
    }
  }
}
