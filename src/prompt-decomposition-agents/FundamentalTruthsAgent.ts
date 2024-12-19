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
- Return ONLY valid JSON.
- The JSON should have the structure:
  {
    "truths": ["truth1", "truth2", ...],
    "relationships": [
      {"from": "truth1", "to": "truth2", "description": "how truth1 supports or relates to truth2"},
      ...
    ]
  }
  
- "truths" should be a JSON array of strings.
- "relationships" should be a JSON array of objects, each with "from", "to", and "description" keys:
  - "from" and "to" must be strings that match exactly one of the truths listed in the "truths" array.
  - "description" should be a short string explaining the nature of their relationship.
  
- No extra text outside the JSON.
`;

    const userMessage = `
User Intent: "${intent}"
Identify the fundamental truths and how they relate to each other.
Return a JSON object with "truths" and "relationships" as described.
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
      const data = JSON.parse(response);
      if (data && Array.isArray(data.truths) && Array.isArray(data.relationships)) {
        // We have truths and relationships
        // Adjust your FundamentalTruthsOutput type if needed to include relationships
        return { status: "success", truths: data.truths, relationships: data.relationships };
      } else {
        return { status: "error", errorMessage: "Missing truths or relationships in response." };
      }
    } catch {
      return { status: "error", errorMessage: "Failed to parse truths and relationships." };
    }
  }
}
