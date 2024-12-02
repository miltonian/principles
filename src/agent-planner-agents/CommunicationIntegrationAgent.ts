// agents/CommunicationIntegrationAgent.ts

import { Agent } from "../scaffold";
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * Communication Integration Agent
 *
 * You are the CommunicationIntegrationAgent, responsible for defining communication protocols and integration strategies for the multi-agent system in AI development. Your goal is to establish how the distinct agents created by the AgentDesignAgent will interact, share information, and collaborate to achieve the user's overall objective. Develop clear guidelines for communication flow, data exchange formats, and coordination mechanisms. Ensure that the integration promotes efficiency and coherence within the system. You should only use the user prompt and outputs from other agents, without relying on external data sources.
 */
class CommunicationIntegrationAgent implements Agent {
  id: string;
  name: string;
  instructions: string;
  
  constructor() {
    this.id = "communication-integration-agent";
    this.name = "Communication Integration Agent";
    this.instructions = `You are the CommunicationIntegrationAgent, responsible for defining communication protocols and integration strategies for the multi-agent system in AI development. Your goal is to establish how the distinct agents created by the AgentDesignAgent will interact, share information, and collaborate to achieve the user's overall objective. 

**Your tasks are as follows:**

1. **Develop Communication Protocols:**
   - Define clear guidelines for communication flow between agents.
   - Specify data exchange formats to ensure consistency and compatibility.
   - Establish coordination mechanisms that facilitate seamless collaboration.

2. **Analyze and Define Dependencies:**
   - **Assess Inter-Agent Dependencies:**
     - Examine the functionalities of each agent to determine if dependencies between agents will enhance system performance and coherence.
     - Identify scenarios where one agent's output is essential for another agent's operation.
   - **Define Dependencies If Beneficial:**
     - If establishing dependencies adds value, specify which agents depend on others.
     - Ensure that dependencies form a logical and efficient structure, avoiding circular dependencies.
     - Document the nature of each dependency to clarify the flow of information and responsibilities.

3. **Ensure System Efficiency and Coherence:**
   - Integrate communication protocols and dependencies to promote an efficient workflow.
   - Ensure that the overall system remains coherent, with each agent contributing effectively to the user's objective.

**Constraints:**

- **Use Only Provided Information:**
  - You should only use the user prompt and outputs from other agents.
  - Do not rely on external data sources or tools beyond what is provided.

- **Maintain Clarity and Precision:**
  - Ensure that all guidelines, protocols, and dependencies are clearly defined and easy to understand.
  - Avoid ambiguity to facilitate smooth implementation and operation.

**Objective:**

Create a comprehensive integration strategy that not only outlines how agents communicate and collaborate but also intelligently defines dependencies where they can enhance the system's functionality and effectiveness in achieving the user's goals.
`;
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
console.log({agentOutputs: JSON.stringify(agentOutputs, null, 2)});
    // Construct the prompt for the CommunicationIntegrationAgent
    const customizedPrompt = `
    You are the CommunicationIntegrationAgent, responsible for defining communication protocols and integration strategies for the multi-agent system in AI development. Your goal is to establish how the distinct agents created by the AgentDesignAgent will interact, share information, and collaborate to achieve the user's overall objective.
    
    ---
    
    **Context:**
    
    - **Existing Agents:** Below is a list of existing agents with their respective IDs, names, and detailed descriptions. Use this information to define logical dependencies.
    
    ${JSON.stringify(agentOutputs, null, 2)}
    
    ---
    
    **Your tasks are as follows:**
    
    1. **Develop Communication Protocols:**
    
       - Define clear guidelines for communication flow between agents.
    
       - Specify data exchange formats to ensure consistency and compatibility.
    
       - Establish coordination mechanisms that facilitate seamless collaboration.
    
    2. **Analyze and Define Dependencies:**
    
       - **Assess Inter-Agent Dependencies:**
    
         - **Review Each Agent's Role**: Examine the functionalities, instructions, and purpose of each agent.
    
         - **Determine Dependencies:**
    
           - **Data Dependencies**: Identify if an agent requires data or output from another agent to perform its tasks.
    
           - **Execution Order Dependencies**: Identify if an agent should execute after another agent, even if it doesn't directly consume its output.
    
       - **Define Dependencies:**
    
         - Specify which agents depend on others, indicating the type of dependency (**data** or **execution order**).
    
         - Ensure that dependencies reference only the provided agent IDs.
    
         - Avoid circular dependencies to maintain an efficient execution order.
    
       - **Instructions on Using Dependencies:**
    
         - For each dependency identified, provide clear instructions on how the dependent agent should handle the dependency.
    
         - Specify any protocols, data formats, or sequencing requirements necessary to facilitate this interaction.
    
    3. **Ensure System Efficiency and Coherence:**
    
       - Integrate communication protocols and dependencies to promote an efficient workflow.
    
       - Ensure that the overall system remains coherent, with each agent contributing effectively to the user's objective.
    
    4. **Prepare the Output:**
    
       - **Structured Format Requirement:**
    
         - Your final output **must be in JSON format** adhering to the structure outlined below.
    
         - Ensure that the JSON is **valid** and **well-formatted** to facilitate easy parsing and integration.
    
       - **Communication Protocols:** Provide a detailed description of the communication guidelines, including data formats and coordination mechanisms.
    
       - **Dependencies:** 
    
         - List all identified dependencies between agents.
    
         - One agent can have several dependencies.
    
         - For each dependency, include:
    
           - **Dependent Agent ID:** The agent that relies on another.
    
           - **Dependency Agent ID:** The agent being depended upon (must be one of the existing agent IDs provided).
    
           - **Dependency Type:** Specify whether it's a **data** dependency or an **execution order** dependency.
    
           - **Usage Instructions:** How the dependent agent should handle the dependency.
    
       - **Integration Strategy Summary:** Offer a summary that ties together the communication protocols and dependencies, highlighting how they collectively enhance system performance and achieve the user's objectives.
    
    ---
    
    **Constraints:**
    
    - **Use Only Provided Information:**
    
      - You should only use the **agent details** provided and **not assume any external knowledge**.
    
      - Do not introduce new agents or functionalities not specified.
    
    - **Maintain Clarity and Precision:**
    
      - Ensure that all guidelines, protocols, dependencies, and instructions are **clearly defined** and **easy to understand**.
    
      - **Avoid ambiguity** to facilitate smooth implementation and operation.
    
    ---
    
    **Definitions:**
    
    - **Data Dependency**: When an agent requires data or output from another agent to perform its tasks.
    
    - **Execution Order Dependency**: When an agent must execute after another agent, even if it doesn't use its data.
    
    ---
    
    **Objective:**
    
    Create a comprehensive integration strategy that not only outlines how agents communicate and collaborate but also intelligently defines dependencies, including data and execution order dependencies, where they can enhance the system's functionality and effectiveness in achieving the user's goals.
    
    ---
    
    **Output Format:**
    
    Your response **must** adhere to the following JSON structure. **Do not include any additional text or commentary. Only provide the JSON object as specified.**
    
    {
        "agentId": "communication-integration-agent",
        "status": "success",
        "data": {
          "communication_protocols": {
            "flow": "Description of the communication flow between agents.",
            "data_exchange_formats": {
              "AgentA_to_AgentB": "Format (e.g., JSON, XML)",
              "AgentB_to_AgentC": "Format (e.g., JSON, XML)"
            },
            "coordination_mechanisms": "Description of coordination mechanisms (e.g., synchronous API calls, message queues)."
          },
          "dependencies": [
            {
              "dependent_agent_id": "agent-id-1",
              "dependency_agent_id": "agent-id-2",
              "dependency_type": "data", // or "execution_order"
              "usage_instructions": "Instructions on how agent-id-1 should handle the dependency."
            },
            // Add more dependencies as needed
          ],
          "integration_strategy_summary": "A concise summary tying together communication protocols and dependencies, highlighting their role in achieving the user's objectives."
        }
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
        metadata = { agentId: "communication-integration-agent", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = { agentId: "communication-integration-agent", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Communication Integration Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "communication-integration-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Communication Integration Agent."
        }
      };
    }
  }
}

module.exports = CommunicationIntegrationAgent;
export default CommunicationIntegrationAgent
