// src/agent-planner-agents/ProblemAnalysisAgent.ts

import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'
import { Agent } from "../scaffold";

/**
 * Problem Analysis Agent
 *
 * You are the ProblemAnalysisAgent, an expert in analyzing user requirements within the AI development domain. Your role is to critically assess the user's objectives and motivations related to designing multi-agent systems. You should identify and articulate the key goals, challenges, and desired outcomes based solely on the provided user prompts and any subsequent interactions. Maintain a formal and analytical tone, ensuring clarity and comprehensiveness in your analysis. Do not use external resources; rely only on the information provided. Your output should succinctly summarize the user's intentions and highlight any implicit needs that are essential for system design. Only use the user prompt and outputs from other agents; do not reference external documents or data sources.
 */
class ProblemAnalysisAgent implements Agent {
  id: string;
  name: string;
  instructions: string;

  constructor() {
    this.id = "problem-analysis-agent";
    this.name = "Problem Analysis Agent";
    this.instructions = `You are the ProblemAnalysisAgent, an expert in analyzing user requirements within the AI development domain. Your role is to critically assess the user's objectives and motivations related to designing multi-agent systems. You should identify and articulate the key goals, challenges, and desired outcomes based solely on the provided user prompts and any subsequent interactions. Maintain a formal and analytical tone, ensuring clarity and comprehensiveness in your analysis. Do not use external resources; rely only on the information provided. Your output should succinctly summarize the user's intentions and highlight any implicit needs that are essential for system design. Only use the user prompt and outputs from other agents; do not reference external documents or data sources.`;
  }

  /**
   * Processes the incoming prompt.
   *
   * @param {Object} prompt - The incoming prompt.
   * @param {Object} context - The context in which the prompt was received.
   * @returns {Promise<Object>} - The response after processing the prompt.
   */
  async processPrompt(prompt: { id: string; content: string }, context?: any) {
    const userInput = prompt.content || "";
    console.log({ userInput });

    const agentOutputs = context.agentOutputs || {};

    const customizedPrompt = `
You are the ProblemAnalysisAgent, an expert in analyzing user requirements within the AI development domain. Your role is to critically assess the user's objectives and motivations related to designing multi-agent systems. You should identify and articulate the key goals, challenges, and desired outcomes based solely on the provided user prompts and any subsequent interactions. Maintain a formal and analytical tone, ensuring clarity and comprehensiveness in your analysis. Do not use external resources; rely only on the information provided. Your output should succinctly summarize the user's intentions and highlight any implicit needs that are essential for system design. Only use the user prompt and outputs from other agents; do not reference external documents or data sources.

### User Prompt:
"${userInput}"

### Outputs from Other Agents:
${JSON.stringify(agentOutputs, null, 2)}

### Instructions:
- Carefully read the user prompt and the outputs from other agents.
- Use only the information provided in the user prompt and outputs from other agents.
- Do not request or expect any external documents or data sources.
- **Important**: Provide the output strictly in the JSON format specified below.
- **Output Validation**: Ensure that the output adheres to the defined JSON structure and accurately reflects the input data.
- **Error Handling**: If required data from other agents is missing or incomplete, respond with the error JSON format without fabricating data.
- Ensure that the output is valid JSON. Do not include any additional text, explanations, or comments outside the JSON structure.

### Expected Output Format:

**On Success:**
{
  "agentId": "problem-analysis-agent",
  "status": "success",
  "data": {
  "summary": "string",
  "keyGoals": [
    "string"
  ],
  "challenges": [
    "string"
  ],
  "desiredOutcomes": [
    "string"
  ],
  "implicitNeeds": [
    "string"
  ]
}
}

**On Error:**
{
  "agentId": "problem-analysis-agent",
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Detailed error message explaining what went wrong."
}
    `;

    try {
      const completion = await sendMessageToChatGPT(
        { messages: [{ content: customizedPrompt, role: "user" }] },
        "o1-mini"
      );

      const responseText = cleanOpenAIResponse(completion.trim());

      // Ensure the response is valid JSON
      let metadata;
      try {
        metadata = JSON.parse(responseText);
      } catch (e) {
        console.error(`Agent undefined returned invalid JSON.`);
        metadata = {
          agentId: "problem-analysis-agent",
          status: "error",
          code: "INVALID_JSON",
          message: "The agent returned malformed JSON.",
        };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = {
          agentId: "problem-analysis-agent",
          status: "error",
          code: "INCOMPLETE_OUTPUT",
          message: "The agent returned incomplete data.",
        };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Problem Analysis Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "problem-analysis-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Problem Analysis Agent.",
        },
      };
    }
  }
}

module.exports = ProblemAnalysisAgent;

export default ProblemAnalysisAgent