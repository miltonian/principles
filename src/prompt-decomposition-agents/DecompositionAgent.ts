// src/agents/DecompositionAgent.ts

import { sendMessageToChatGPT } from "../llms/openaiClient";
import { DecompositionOutput } from "./types";
import { cleanOpenAIResponse } from "../utils/responseUtils";

export class DecompositionAgent {
  async decompose(intent: string, truths: string[]): Promise<DecompositionOutput> {
    if (!intent || truths.length === 0) {
      return { status: "error", errorMessage: "Intent or truths missing." };
    }

    const systemPrompt = `
You break down the intent into minimal subtasks.
Each subtask must:
- Be an action or step that a purely text-based agent can perform (e.g., analyzing, summarizing, generating instructions, providing suggestions, reasoning).
- NOT involve physical actions, external API calls, or tasks requiring the agent to do something outside textual reasoning.
- NOT involve "submitting" to external systems. Instead, if needed, frame steps as "propose how to..." or "draft a summary for review" rather than performing the submission.
- Return ONLY a JSON array of strings, no extra text.
`;

    const userMessage = `
Intent: "${intent}"
Fundamental Truths: ${JSON.stringify(truths)}

Decompose the intent into minimal subtasks that a text-based assistant can realistically perform. Output a JSON array of strings:
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
  }, 'o1-mini'));
  
    try {
      const subtasks = JSON.parse(response);
      if (Array.isArray(subtasks)) {
        return { status: "success", subtasks };
      } else {
        return { status: "error", errorMessage: "No array found for subtasks." };
      }
    } catch {
      return { status: "error", errorMessage: "Failed to parse subtasks." };
    }
  }
}
