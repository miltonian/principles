// src/agents/IntegrationAgent.ts

import { sendMessageToChatGPT } from "../llms/openaiClient";
import { cleanOpenAIResponse } from "../utils/responseUtils";
import { FinalIntegrationOutput, AgentDescription } from "./types";

export class IntegrationAgent {
  async integrate(
    intent: string,
    parameters: Record<string, string>,
    truths: string[],
    subtasks: string[]
  ): Promise<FinalIntegrationOutput> {
    if (!intent || truths.length === 0 || subtasks.length === 0) {
      return { status: "error", errorMessage: "Missing key components for integration." };
    }

    const agents: AgentDescription[] = [];

    for (let i = 0; i < subtasks.length; i++) {
      const task = subtasks[i];

      const systemPrompt = `
You are a specialized assistant. You will take context and produce a detailed JSON for an AgentDescription.

The AgentDescription must include:
{
  "id": "string",
  "name": "string",
  "role": "string",            // The subtask itself
  "purpose": "string",         // High-level reason for this agent
  "domainContext": "string",   // Summarize intent, parameters, truths
  "detailedInstructions": "string", 
  "inputFormat": "string", 
  "outputFormat": "string", 
  "constraints": "string", 
  "resources": "string", 
  "communicationStyle": "string",
  "exampleInteractions": ["string", ...],
  "expertiseLevel": "string",
  "persona": "string",
  "functionality": "string",
  "responsibilities": "string"
}

Rules:
- Return ONLY the JSON object. No extra text.
- Make the fields exhaustive, context-driven, and unique for this agent.
- This agent is derived from a subtask and must reflect that subtask precisely.
`;

      const userMessage = `
Intent: "${intent}"
Parameters: ${JSON.stringify(parameters)}
FundamentalTruths: ${JSON.stringify(truths)}
Subtask: "${task}"

Using all this context, produce a JSON AgentDescription that:
- Incorporates the intent and truths into "domainContext" and "resources".
- Tailors "detailedInstructions" to perform the "${task}" optimally.
- Sets "constraints" respecting the truths and parameters.
- Provides realistic "exampleInteractions" showing how the agent handles queries related to "${task}".
- Sets "persona", "functionality", "responsibilities" aligned with achieving "${task}" from first principles.
- Choose an appropriate "name" and "id" for the agent. ID can be "agent-${i+1}" and name "Agent_${i+1}".
- The role is the subtask string.
- Be exhaustive, so another system can easily generate a final prompt for this agent from this JSON.
`;

      const response = cleanOpenAIResponse(await sendMessageToChatGPT({
        messages: [{role: 'user', content: `
            ## Instructions
            ${systemPrompt}

            ${userMessage}
            `}]
    }, ));

      try {
        const agentData = JSON.parse(response) as AgentDescription;
        agents.push(agentData);
      } catch {
        return { status: "error", errorMessage: `Failed to parse agent JSON for subtask "${task}"` };
      }
    }

    return {
      status: "success",
      finalBreakdown: {
        intent,
        parameters,
        fundamentalTruths: truths,
        subtasks,
        agents
      }
    };
  }
}
