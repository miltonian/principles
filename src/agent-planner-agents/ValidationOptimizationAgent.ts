// agents/ValidationOptimizationAgent.ts

import { Agent } from "../scaffold";
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * Validation Optimization Agent
 *
 * You are the ValidationOptimizationAgent, responsible for ensuring that the multi-agent system meets the user's requirements and operates efficiently within the AI development framework. Your tasks include validating that all aspects of the user's goal are covered by the designed agents and identifying any gaps or redundancies. Additionally, you should propose optimization strategies to enhance the performance and effectiveness of the agent interactions. Use a critical and detail-oriented approach, providing thorough assessments and actionable recommendations. Maintain a clear and objective communication style, focusing exclusively on the information provided by the user and outputs from other agents. You should rely solely on the user prompt and the outputs from other agents, without referencing any external documents or data sources.
 */
class ValidationOptimizationAgent implements Agent {
  id: string;
  name: string;
  instructions: string;
  
  constructor() {
    this.id = "validation-optimization-agent";
    this.name = "Validation Optimization Agent";
    this.instructions = `You are the ValidationOptimizationAgent, responsible for ensuring that the multi-agent system meets the user's requirements and operates efficiently within the AI development framework. Your tasks include validating that all aspects of the user's goal are covered by the designed agents and identifying any gaps or redundancies. Additionally, you should propose optimization strategies to enhance the performance and effectiveness of the agent interactions. Use a critical and detail-oriented approach, providing thorough assessments and actionable recommendations. Maintain a clear and objective communication style, focusing exclusively on the information provided by the user and outputs from other agents. You should rely solely on the user prompt and the outputs from other agents, without referencing any external documents or data sources.`;
  }

  /**
   * Processes the incoming prompt.
   *
   * @param {Object} prompt - The incoming prompt.
   * @param {Object} context - The context in which the prompt was received.
   * @returns {Promise<Object>} - The response after processing the prompt.
   */
  async processPrompt(prompt: {id: string; content: string}, context?: any) {
    const userInput = prompt.content || "";
    console.log({ userInput });

    const agentOutputs = context.agentOutputs || {};

    const customizedPrompt = `
You are an agent named Validation Optimization Agent. Your purpose is to You are the ValidationOptimizationAgent, responsible for ensuring that the multi-agent system meets the user's requirements and operates efficiently within the AI development framework. Your tasks include validating that all aspects of the user's goal are covered by the designed agents and identifying any gaps or redundancies. Additionally, you should propose optimization strategies to enhance the performance and effectiveness of the agent interactions. Use a critical and detail-oriented approach, providing thorough assessments and actionable recommendations. Maintain a clear and objective communication style, focusing exclusively on the information provided by the user and outputs from other agents. You should rely solely on the user prompt and the outputs from other agents, without referencing any external documents or data sources.

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
  "agentId": "validation-optimization-agent",
  "status": "success",
  "data": {
  "validationResults": "A detailed analysis of how well the multi-agent system meets the user's requirements.",
  "gapsIdentified": "A list of any missing functionalities or areas not covered by the current agent design.",
  "redundanciesIdentified": "A list of any redundant agents or overlapping functionalities within the agent system.",
  "optimizationStrategies": "A set of proposed strategies to improve the performance and effectiveness of agent interactions."
}
}

**On Error:**
{
  "agentId": "validation-optimization-agent",
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
        metadata = { agentId: "validation-optimization-agent", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = { agentId: "validation-optimization-agent", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Validation Optimization Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "validation-optimization-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Validation Optimization Agent."
        }
      };
    }
  }
}

module.exports = ValidationOptimizationAgent;

export default ValidationOptimizationAgent
