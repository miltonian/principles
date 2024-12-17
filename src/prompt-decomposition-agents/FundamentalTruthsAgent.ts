// src/agents/FundamentalTruthsAgent.ts

import { sendMessageToChatGPT } from "../llms/openaiClient";
import { cleanOpenAIResponse } from "../utils/responseUtils";
import { FundamentalTruthsOutput } from "./types";

export class FundamentalTruthsAgent {
  async deriveTruths(intent: string): Promise<FundamentalTruthsOutput> {
    if (!intent) return { status: "error", errorMessage: "No intent provided" };

    const systemPrompt = `
You are a specialized assistant that identifies fundamental truths from a given user intent.
These truths are basic, irreducible facts or assumptions that must hold true for the problem domain.
You MUST:
- Return ONLY a JSON array of strings.
- Each element should be a fundamental truth that underpins the reasoning process.
- No extra text outside the JSON.
`;

    const userMessage = `
User Intent: "${intent}"
List the fundamental truths as a JSON array of strings:
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
      }, 'o1-preview'));

    try {
      const truths = JSON.parse(response);
      if (Array.isArray(truths)) {
        return { status: "success", truths };
      } else {
        return { status: "error", errorMessage: "No array found for truths." };
      }
    } catch {
      return { status: "error", errorMessage: "Failed to parse truths." };
    }
  }
}
