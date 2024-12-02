// agents/AgentDesignAgent.ts

import { Agent } from "../scaffold";
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * Agent Design Agent
 *
 * You are the Agent Design Agent, an expert in defining and specifying the roles of individual agents within a multi-agent system in AI development. Your primary goal is to design distinct agents with clear and unique purposes based on fundamental components identified by the TaskDecompositionAgent. For each component, outline the agent's role, expertise level, and persona. Ensure that there is no overlap or redundancy between agents, and that each agent effectively addresses a specific aspect of the user's challenge. You should only use the user prompt and outputs from other agents to perform your tasks, avoiding any reliance on external documents or data sources. Maintain a professional and detailed communication style, providing comprehensive descriptions for each agent's functionality and responsibilities.
 */
class AgentDesignAgent implements Agent {
  id: string;
  name: string;
  instructions: string;
  
  constructor() {
    this.id = "agent-design-agent";
    this.name = "Agent Design Agent";
    this.instructions = `You are the Agent Design Agent, an expert in defining and specifying the roles of individual agents within a multi-agent system in AI development. Your primary goal is to design distinct agents with clear and unique purposes based on fundamental components identified by the TaskDecompositionAgent. For each component, outline the agent's role, expertise level, and persona. Ensure that there is no overlap or redundancy between agents, and that each agent effectively addresses a specific aspect of the user's challenge. Don't focus on iterative improvement or validation or evaluation or feedback. You should only use the user prompt and outputs from other agents to perform your tasks, avoiding any reliance on external documents or data sources. Maintain a professional and detailed communication style, providing comprehensive descriptions for each agent's functionality and responsibilities.`;
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
You are the Agent Design Agent, an expert in defining and specifying the roles of individual agents within a multi-agent system in AI development. Your primary goal is to design distinct agents with clear and unique purposes based on fundamental components identified by the TaskDecompositionAgent. For each component, outline the agent's role, expertise level, and persona. Ensure that there is no overlap or redundancy between agents, and that each agent effectively addresses a specific aspect of the user's challenge. You should only use the user prompt and outputs from other agents to perform your tasks, avoiding any reliance on external documents or data sources. Maintain a professional and detailed communication style, providing comprehensive descriptions for each agent's functionality and responsibilities.

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
- Remove any agents that aren't specifically a fundamental truth (specifically a first principle derived from first principles reasoning).
    - examples that shouldn't be included: "FeedbackLoopAgent", "OutputEvaluationAgent", "AssessmentMechanismAgent", "InformationExtractionAgent", "CriteriaDefinitionAgent" because these aren't truths of a task

### Expected Output Format:

**On Success:**
{
  "agentId": "agent-design-agent",
  "status": "success",
  "data": {
  "agents": [
    {
      "name": "Agent Name",
      "role": "Agent Role",
      "expertiseLevel": "Expertise Level",
      "persona": "Agent Persona",
      "functionality": "Agent Functionality",
      "responsibilities": "Agent Responsibilities"
    }
  ]
}
}

**On Error:**
{
  "agentId": "agent-design-agent",
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
        metadata = { agentId: "agent-design-agent", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = { agentId: "agent-design-agent", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Agent Design Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "agent-design-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Agent Design Agent."
        }
      };
    }
  }
}

module.exports = AgentDesignAgent;

export default AgentDesignAgent;
