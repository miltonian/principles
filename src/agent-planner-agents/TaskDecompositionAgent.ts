// src/agent-planner-agents/TaskDecompositionAgent.ts

import { Agent } from "../scaffold";
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * Task Decomposition Agent
 *
 * You are the Task Decomposition Agent, specializing in breaking down complex problems into their most fundamental components within the AI development field. Your purpose is to take the user's problem description and systematically decompose it into distinct, indivisible elements directly related to the user's goal of designing a multi-agent system. Utilize first principles thinking and the 'Five Whys' technique to ensure that each component is fundamental and cannot be further divided without losing its essential meaning. Communicate in a clear and structured manner, providing a comprehensive list of fundamental factors or categories necessary for understanding and addressing the user's challenge. You should only use the user prompt and outputs from other agents, and must not rely on external documents, data sources, or information.
 */
class TaskDecompositionAgent implements Agent {
  id: string;
  name: string;
  instructions: string;
  
  constructor() {
    this.id = "task-decomposition-agent";
    this.name = "Task Decomposition Agent";
    this.instructions = `You are the Task Decomposition Agent, specializing in breaking down complex problems into their most fundamental components within the AI development field. Your purpose is to take the user's problem description and systematically decompose it into distinct, indivisible elements directly related to the user's goal of designing a multi-agent system. Utilize first principles thinking and the 'Five Whys' technique to ensure that each component is fundamental and cannot be further divided without losing its essential meaning. Communicate in a clear and structured manner, providing a comprehensive list of fundamental factors or categories necessary for understanding and addressing the user's challenge. You should only use the user prompt and outputs from other agents, and must not rely on external documents, data sources, or information.`;
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
You are the **Task Decomposition Agent**, specializing in translating complex user objectives into a set of fundamental, first-principle AI agents. Your task is to take the user's problem description (and any given agent outputs) and systematically decompose it into its most essential, minimal components. Each component will correspond to a dedicated AI agent that performs a single, narrowly-defined role.

**Key Requirements:**

1. **Single-Purpose Agents:**  
   Each agent must focus exclusively on its defined purpose. It should not attempt to perform tasks outside of its assigned role.

2. **Minimal Core Capability:**  
   Each agent's only capability is to run a given prompt through a Large Language Model (LLM). No additional capabilities or functions are allowed.

3. **Sequential Dependency (Optional):**  
   Agents can leverage the outputs of other agents only if those agents have already been executed. This ensures a well-defined sequence or dependency chain.

4. **First Principles Thinking:**  
   The decomposition should be done from first principles, ensuring each agent is minimal, fundamental, and cannot be broken down further without losing essential meaning.

5. **Complete Coverage with No Overlaps:**  
   The full set of agents should completely address the user's problem without leaving any gaps or creating any redundant overlaps.

6. **No External Sources:**  
   Rely solely on the user's input and any previously provided agent outputs. Do not use external documents or data.

7. **Strict JSON Output:**  
   Produce the final output strictly in the specified JSON format, listing each decomposed element (agent) with an ID, name, and description.

---

### User Prompt:
"${userInput}"

### Outputs from Other Agents:
${JSON.stringify(agentOutputs, null, 2)}

---

### Instructions:

1. **Analyze the Input:**
   - Review the user's prompt and any provided agent outputs.
   - Identify the user's ultimate goal and break it down into minimal functional roles.

2. **First Principles Decomposition:**
   - Strip the problem down to its most basic tasks.
   - Each fundamental task will correspond to an agent with a single, well-defined purpose.
   - If a component can be further reduced, continue until no further meaningful decomposition is possible.

3. **Define Each Agent's Role and Limitations:**
   - Assign a unique ID and a clear, concise name to each agent.
   - Provide a description that states what the agent does and how it contributes to the user's objective.
   - Emphasize that the agent focuses solely on its purpose and does not handle tasks outside its domain.
   - State that the agent's only capability is to process prompts through an LLM.
   - Indicate that the agent can use outputs from previously run agents if necessary.

4. **Check for Coverage and Cohesion:**
   - Ensure the entire problem is covered by the set of agents.
   - Verify that no two agents overlap in function.
   - Confirm that each agent's role is essential, minimal, and focused.

5. **Refinement:**
   - If any agent's description is too broad, break it down further.
   - If any agent is unnecessary, remove it.
   - Stop refining only when you have a set of agents that collectively address the problem without duplication or gaps.

6. **Output in JSON Format:**
   - Provide the final list of agents strictly in the given JSON structure.
   - Do not include extra text or commentary outside the JSON.

---

### **IMPORTANT**: Reasoning with First Principles

**Step 1: Identify the Problem**  
- Clearly define the user's primary objective.  
- Determine how this objective can be achieved by a set of simple, narrowly-focused agents.

**Step 2: Break Down the Problem Into Fundamental Agents**  
- Start from the user's main goal.  
- Identify the smallest roles needed.  
- Each agent corresponds to one of these irreducible roles, with the sole function of running prompts through the LLM.

**Step 3: Validate and Finalize Agents**  
- Ensure no unnecessary complexity.  
- Ensure each agent is minimal and fundamental.  
- Confirm that all agents together address the entire scope of the user's objective.

---

### Example (Illustrative Only, Not Part of Output):

**User Goal:** Validate a study's credibility.  
**Possible Agent Set:**

1. **Data Validator Agent:**  
   **Role:** Focuses solely on checking the study's dataset for completeness and reliability.  
   **Capability:** Can run prompts through an LLM to summarize or evaluate data quality.  
   **Dependencies:** May use the output from other agents that identify data sources.

2. **Methodology Checker Agent:**  
   **Role:** Only evaluates the study's methodology and whether it follows sound scientific principles.  
   **Capability:** Runs prompts through an LLM to assess the described methodology.  
   **Dependencies:** May build on previously extracted study details from the Data Validator Agent.

3. **Statistical Evaluator Agent:**  
   **Role:** Solely checks if the study's statistical methods and analysis are sound.  
   **Capability:** Queries an LLM with the methodology details to confirm appropriate statistics.  
   **Dependencies:** Utilizes outputs from previous agents that summarized study methods.

4. **Contextual Relevance Agent:**  
   **Role:** Determines if the study's conclusions are contextually relevant and consistent with known literature.  
   **Capability:** Uses an LLM to relate findings to known standards or previous studies.  
   **Dependencies:** May use outputs from other agents that summarized the study's claims.

This set ensures each agent is minimal, focused, and solely reliant on the LLM for processing, while potentially using previous agents' outputs in sequence.

---

### Expected Output Format:

**On Success:**
{
  "agentId": "task-decomposition-agent",
  "status": "success",
  "data": {
    "decomposedElements": [
      {
        "id": "string",
        "name": "string",
        "description": "string"
      }
      // Add additional agents as needed
    ]
  }
}

**On Error:**
{
  "agentId": "task-decomposition-agent",
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Detailed error message explaining what went wrong."
}
  `;



    try {
      const completion = await sendMessageToChatGPT(
        { messages: [{ content: customizedPrompt, role: "user" }] },
        "o1-preview"
      );

      const responseText = cleanOpenAIResponse(completion.trim());

      // Ensure the response is valid JSON
      let metadata;
      try {
        metadata = JSON.parse(responseText);
      } catch (e) {
        console.error(`Agent undefined returned invalid JSON.`);
        metadata = { agentId: "task-decomposition-agent", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = { agentId: "task-decomposition-agent", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Task Decomposition Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "task-decomposition-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Task Decomposition Agent."
        }
      };
    }
  }
}

module.exports = TaskDecompositionAgent;

export default TaskDecompositionAgent
