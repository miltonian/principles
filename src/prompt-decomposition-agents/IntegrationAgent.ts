// src/agents/IntegrationAgent.ts

import { sendMessageToChatGPT } from "../llms/openaiClient";
import { cleanOpenAIResponse } from "../utils/responseUtils";
import { FinalIntegrationOutput, AgentDescription } from "./types";

export class IntegrationAgent {
  async integrate(
    intent: string,
    parameters: Record<string, string>,
    truths: string[],
    subtasks: string[],
    relationships: {from: string, to: string, description: string}[]
  ): Promise<FinalIntegrationOutput> {
    if (!intent || truths.length === 0 || subtasks.length === 0) {
      return { status: "error", errorMessage: "Missing key components for integration." };
    }

    const agents: AgentDescription[] = [];

    const systemPrompt = `
You are a specialized assistant that will produce a JSON AgentDescription for each subtask.

**Important**:
- Each agent corresponds to a subtask.
- Agents are named "agent-1", "agent-2", ... in the order subtasks are given.
- "dependencies" must only include agent IDs from among these generated agents.
- If the agent for subtask i needs the output from subtask j, then "dependencies" must include "agent-j".
- If no other agent's output is required, "dependencies": [].
- Do not include any external dependencies not generated here.
- Return ONLY the JSON object. No extra text.
`.trim();

    for (let i = 0; i < subtasks.length; i++) {
      const taskIndex = i + 1;
      const task = subtasks[i];

      const userMessage = `
You are generating an AgentDescription for:
- Intent: "${intent}"
- Parameters: ${JSON.stringify(parameters)}
- FundamentalTruths: ${JSON.stringify(truths)}
- Subtasks (and their agent IDs):
- Relationships: ${JSON.stringify(relationships, null, 2)}
${subtasks.map((st, idx) => `- Subtask ${idx+1}: "${st}" => agent-${idx+1}`).join('\n')}

Now focus on Subtask ${taskIndex}: "${task}"
This agent will be "agent-${taskIndex}".

Instructions for Dependencies:
- If this agent needs data or results from another agent (i.e., from a previously listed subtask), include that agent's ID in "dependencies".
- For example, if it needs the output from subtask 2, add "agent-2" to dependencies.
- If no other agent's output is needed, "dependencies": [].

Also produce the other required fields:
{
  "id": "agent-${taskIndex}",
  "name": "Agent_${taskIndex}",
  "role": "${task}",
  "purpose": "Explain the agent's high-level reason.",
  "domainContext": "Incorporate intent and truths.",
  "detailedInstructions": "Detail step-by-step how to handle this subtask.",
  "inputFormat": "What input does it expect?",
  "outputFormat": "What output it produces?",
  "constraints": "Any constraints from truths/parameters?",
  "resources": "Any domain knowledge or references?",
  "communicationStyle": "How does it communicate?",
  "exampleInteractions": ["Provide some example Q&A or usage."],
  "expertiseLevel": "e.g., expert, intermediate.",
  "persona": "Describe the persona.",
  "functionality": "Explain functionality in detail.",
  "responsibilities": "List responsibilities.",
  "dependencies": []
}

Adjust "dependencies" based on logical needs. If this subtask references another subtask's results, add that agent's ID. If not, leave it empty.
`.trim();

      let lastError: Error | null = null;
      let agentData: AgentDescription | null = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const rawResponse = await sendMessageToChatGPT({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ]
          }, "gpt-4o-mini");

          const response = cleanOpenAIResponse(rawResponse.trim());
          agentData = JSON.parse(response) as AgentDescription;

          // Validate dependencies is an array
          if (!agentData.dependencies || !Array.isArray(agentData.dependencies)) {
            throw new Error("Missing or invalid 'dependencies' field.");
          }

          // Check that dependencies only reference known agents (agent-1 to agent-X)
          // For safety, ensure no unknown references:
          for (const dep of agentData.dependencies) {
            const match = dep.match(/^agent-(\d+)$/);
            if (!match) {
              throw new Error(`Dependency "${dep}" is invalid. Must be like agent-1, agent-2, etc.`);
            }
            const depIndex = parseInt(match[1]);
            if (depIndex < 1 || depIndex > subtasks.length) {
              throw new Error(`Dependency "${dep}" out of range. We only have agent-1 to agent-${subtasks.length}.`);
            }
          }

          // If no error thrown, break out of the retry loop.
          break;
        } catch (error: any) {
          lastError = error;
          if (attempt < 3) {
            // Retry
          } else {
            return {
              status: "error",
              errorMessage: `Failed to parse or validate agent JSON for subtask "${task}" after 3 attempts: ${error.message}`
            };
          }
        }
      }

      if (!agentData) {
        return {
          status: "error",
          errorMessage: `Failed to parse agent JSON for subtask "${task}". ${lastError?.message}`
        };
      }

      agents.push(agentData);
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
