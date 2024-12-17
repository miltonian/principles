// src/agents/RefinementDecisionAgent.ts

import { sendMessageToChatGPT } from "../llms/openaiClient";
import { RefinementDecisionOutput } from "./types";
import { cleanOpenAIResponse } from "../utils/responseUtils";

export class RefinementDecisionAgent {
  async decide(intent: string, truths: string[], subtasks: string[]): Promise<RefinementDecisionOutput> {
    if (!intent || subtasks.length === 0) {
      return { status: "error", errorMessage: "Missing intent or subtasks." };
    }

    const systemPrompt = `
You are a decision-making assistant that determines the next step in refinement.
You can choose one of three decisions:
- "finalize": If the fundamental truths and subtasks are all consistent, minimal, and aligned.
- "refine_subtasks": If the truths seem correct but subtasks are not minimal or aligned.
- "refine_truths": If the fundamental truths appear incomplete, incorrect, or insufficient to produce minimal aligned subtasks.

Return ONLY a JSON object:
{"decision":"finalize|refine_subtasks|refine_truths","notes":"..."}
No extra text.
`;

    const userMessage = `
Intent: "${intent}"
FundamentalTruths: ${JSON.stringify(truths)}
Subtasks: ${JSON.stringify(subtasks)}

Decide next step:
- If truths are good and subtasks minimal: finalize
- If truths are good but subtasks need improvement: refine_subtasks
- If truths are insufficient or misaligned: refine_truths
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
      if (data.decision === "finalize" || data.decision === "refine_subtasks" || data.decision === "refine_truths") {
        return { status: "success", decision: data.decision, notes: data.notes };
      } else {
        return { status: "error", errorMessage: "No valid decision found." };
      }
    } catch {
      return { status: "error", errorMessage: "Failed to parse decision." };
    }
  }
}
