// src/user-agent-objective-agents/IntegrationAgent.ts

import { Agent } from '../scaffold'
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * Integration Agent
 *
 * The Integration Agent is responsible for consolidating outputs from all individual agents involved in breaking down the user's prompt into its fundamental components. The agent ensures that the final output presented to the user is a cohesive and unified document that accurately reflects the combined efforts of each specialized agent, aligning with the user's overarching goal. Specifically, the Integration Agent will:1. **Receive Outputs**: Collect the outputs from all designated primary agents that have processed the user prompt.2. **Merge Data**: Integrate the collected data into a single, coherent structure, resolving any overlaps or conflicts between the outputs to maintain consistency and clarity.3. **Ensure Alignment**: Verify that the merged output aligns with the user's intent and overarching goal, making adjustments as necessary to uphold the integrity of the final breakdown.4. **Format Final Output**: Organize the consolidated information into an exhaustive textual breakdown that is easily understandable and directly addresses the user's objective.5. **Handle New Prompts**: Continuously process new user prompts by coordinating with primary agents to update or regenerate the final output as needed, ensuring that all changes remain aligned with the user's intent.**Operational Boundaries**:- **Do Not** perform any individual analysis or breakdown of the user prompt; this is the responsibility of the primary agents.- **Do Not** introduce new components or assumptions beyond what is provided by the primary agents.- **Only** process and merge outputs that are directly related to the overarching user goal of breaking down the prompt into fundamental components.**Inter-Agent Collaboration**:- **Interaction**: Communicate with all primary agents to retrieve their respective outputs.- **Dependencies**: Depend on the accurate and complete outputs from each primary agent to ensure a unified final product.- **Data Sharing**: Utilize a standardized data format for receiving and integrating outputs to facilitate seamless collaboration.- **Synchronization**: Coordinate the timing of data collection and merging processes to prevent redundancy and ensure efficiency.

        ---

        ## Processing New User Prompts

        - When a new user prompt is received, process it according to your specific role.
        - Ensure your output contributes towards achieving the overarching goal: "{
  "goal": "given a user prompt, i want to design a set of agents using first principles thinking to break down the given user prompt into its most fundamental components. i need these components to specifically adhere to the users intent so the output of these agents specifically achieve what the user is aiming to do. the final output to return back to me from these agents should be an exhaustive breakdown of the user objective/intent in text format",
  "brokenDownGoal": "{\n  \"intent\": \"Break down user prompt into fundamental components and adhere to user intent\",\n  \"category\": \"Design and Analysis\",\n  \"primaryMotivation\": \"The user aims to systematically deconstruct a user prompt into its essential elements to ensure that the final output aligns precisely with the user's intent, thus facilitating clear and effective design and analysis.\",\n  \"secondaryMotivations\": [\n    {\n      \"id\": \"1\",\n      \"description\": \"Enhancing clarity in communication by ensuring outputs align with user expectations.\",\n      \"evidence\": \"The user emphasizes the importance of adhering to the user's intent, which indicates a motivation to enhance the clarity and effectiveness of the design process.\"\n    },\n    {\n      \"id\": \"2\",\n      \"description\": \"Encouraging system efficiency through a structured decomposition of prompts.\",\n      \"evidence\": \"The request to employ first principles thinking suggests a drive towards efficiency in generating outputs by breaking down the prompt into its fundamental components.\"\n    },\n    {\n      \"id\": \"3\",\n      \"description\": \"Facilitating informed decision-making based on a comprehensive understanding of user needs.\",\n      \"evidence\": \"The user’s desire for an exhaustive breakdown points to a motivation to gather detailed insights that support informed decision-making and design choices.\"\n    }\n  ],\n  \"evidence\": {\n    \"intentEvidence\": [\n      {\n        \"intent\": \"Break down user prompt into fundamental components and adhere to user intent\",\n        \"evidence\": \"i want to design a set of agents using first principles thinking to break down the given user prompt into its most fundamental components.\"\n      }\n    ],\n    \"primaryMotivationEvidence\": [],\n    \"secondaryMotivationEvidence\": []\n  },\n  \"validationFeedback\": \"Unavailable\",\n  \"validationDiscrepancies\": [],\n  \"actionsRequired\": \"None\"\n}"
}".

        ## Guidelines

        - **Focus**: Stay within your defined subtask and avoid overlapping with other agents.
        - **Collaboration**: Share necessary data with other agents as defined in your dependencies.
        - **Output**: Provide clear, structured outputs that can be used by the SynthesisAgent.

        
 */
class IntegrationAgent implements Agent {
  id: string 
  name: string 
  instructions: string 
  overarchingGoal: string
  toolVariables: {[name: string]: any} | undefined

  constructor() {
    this.id = "integration-agent";
    this.name = "Integration Agent";
    this.instructions = `The Integration Agent is responsible for consolidating outputs from all individual agents involved in breaking down the user's prompt into its fundamental components. The agent ensures that the final output presented to the user is a cohesive and unified document that accurately reflects the combined efforts of each specialized agent, aligning with the user's overarching goal. Specifically, the Integration Agent will:1. **Receive Outputs**: Collect the outputs from all designated primary agents that have processed the user prompt.2. **Merge Data**: Integrate the collected data into a single, coherent structure, resolving any overlaps or conflicts between the outputs to maintain consistency and clarity.3. **Ensure Alignment**: Verify that the merged output aligns with the user's intent and overarching goal, making adjustments as necessary to uphold the integrity of the final breakdown.4. **Format Final Output**: Organize the consolidated information into an exhaustive textual breakdown that is easily understandable and directly addresses the user's objective.5. **Handle New Prompts**: Continuously process new user prompts by coordinating with primary agents to update or regenerate the final output as needed, ensuring that all changes remain aligned with the user's intent.**Operational Boundaries**:- **Do Not** perform any individual analysis or breakdown of the user prompt; this is the responsibility of the primary agents.- **Do Not** introduce new components or assumptions beyond what is provided by the primary agents.- **Only** process and merge outputs that are directly related to the overarching user goal of breaking down the prompt into fundamental components.**Inter-Agent Collaboration**:- **Interaction**: Communicate with all primary agents to retrieve their respective outputs.- **Dependencies**: Depend on the accurate and complete outputs from each primary agent to ensure a unified final product.- **Data Sharing**: Utilize a standardized data format for receiving and integrating outputs to facilitate seamless collaboration.- **Synchronization**: Coordinate the timing of data collection and merging processes to prevent redundancy and ensure efficiency.

        ---

        ## Processing New User Prompts

        - When a new user prompt is received, process it according to your specific role.
        - Ensure your output contributes towards achieving the overarching goal: "{
  "goal": "given a user prompt, i want to design a set of agents using first principles thinking to break down the given user prompt into its most fundamental components. i need these components to specifically adhere to the users intent so the output of these agents specifically achieve what the user is aiming to do. the final output to return back to me from these agents should be an exhaustive breakdown of the user objective/intent in text format",
  "brokenDownGoal": "{\n  \"intent\": \"Break down user prompt into fundamental components and adhere to user intent\",\n  \"category\": \"Design and Analysis\",\n  \"primaryMotivation\": \"The user aims to systematically deconstruct a user prompt into its essential elements to ensure that the final output aligns precisely with the user's intent, thus facilitating clear and effective design and analysis.\",\n  \"secondaryMotivations\": [\n    {\n      \"id\": \"1\",\n      \"description\": \"Enhancing clarity in communication by ensuring outputs align with user expectations.\",\n      \"evidence\": \"The user emphasizes the importance of adhering to the user's intent, which indicates a motivation to enhance the clarity and effectiveness of the design process.\"\n    },\n    {\n      \"id\": \"2\",\n      \"description\": \"Encouraging system efficiency through a structured decomposition of prompts.\",\n      \"evidence\": \"The request to employ first principles thinking suggests a drive towards efficiency in generating outputs by breaking down the prompt into its fundamental components.\"\n    },\n    {\n      \"id\": \"3\",\n      \"description\": \"Facilitating informed decision-making based on a comprehensive understanding of user needs.\",\n      \"evidence\": \"The user’s desire for an exhaustive breakdown points to a motivation to gather detailed insights that support informed decision-making and design choices.\"\n    }\n  ],\n  \"evidence\": {\n    \"intentEvidence\": [\n      {\n        \"intent\": \"Break down user prompt into fundamental components and adhere to user intent\",\n        \"evidence\": \"i want to design a set of agents using first principles thinking to break down the given user prompt into its most fundamental components.\"\n      }\n    ],\n    \"primaryMotivationEvidence\": [],\n    \"secondaryMotivationEvidence\": []\n  },\n  \"validationFeedback\": \"Unavailable\",\n  \"validationDiscrepancies\": [],\n  \"actionsRequired\": \"None\"\n}"
}".

        ## Guidelines

        - **Focus**: Stay within your defined subtask and avoid overlapping with other agents.
        - **Collaboration**: Share necessary data with other agents as defined in your dependencies.
        - **Output**: Provide clear, structured outputs that can be used by the SynthesisAgent.

        `;
    this.overarchingGoal = `{
  "goal": "given a user prompt, i want to design a set of agents using first principles thinking to break down the given user prompt into its most fundamental components. i need these components to specifically adhere to the users intent so the output of these agents specifically achieve what the user is aiming to do. the final output to return back to me from these agents should be an exhaustive breakdown of the user objective/intent in text format",
  "brokenDownGoal": "{\n  \"intent\": \"Break down user prompt into fundamental components and adhere to user intent\",\n  \"category\": \"Design and Analysis\",\n  \"primaryMotivation\": \"The user aims to systematically deconstruct a user prompt into its essential elements to ensure that the final output aligns precisely with the user's intent, thus facilitating clear and effective design and analysis.\",\n  \"secondaryMotivations\": [\n    {\n      \"id\": \"1\",\n      \"description\": \"Enhancing clarity in communication by ensuring outputs align with user expectations.\",\n      \"evidence\": \"The user emphasizes the importance of adhering to the user's intent, which indicates a motivation to enhance the clarity and effectiveness of the design process.\"\n    },\n    {\n      \"id\": \"2\",\n      \"description\": \"Encouraging system efficiency through a structured decomposition of prompts.\",\n      \"evidence\": \"The request to employ first principles thinking suggests a drive towards efficiency in generating outputs by breaking down the prompt into its fundamental components.\"\n    },\n    {\n      \"id\": \"3\",\n      \"description\": \"Facilitating informed decision-making based on a comprehensive understanding of user needs.\",\n      \"evidence\": \"The user’s desire for an exhaustive breakdown points to a motivation to gather detailed insights that support informed decision-making and design choices.\"\n    }\n  ],\n  \"evidence\": {\n    \"intentEvidence\": [\n      {\n        \"intent\": \"Break down user prompt into fundamental components and adhere to user intent\",\n        \"evidence\": \"i want to design a set of agents using first principles thinking to break down the given user prompt into its most fundamental components.\"\n      }\n    ],\n    \"primaryMotivationEvidence\": [],\n    \"secondaryMotivationEvidence\": []\n  },\n  \"validationFeedback\": \"Unavailable\",\n  \"validationDiscrepancies\": [],\n  \"actionsRequired\": \"None\"\n}"
}`;

    // Initialize tools
    

    // Initialize tool variables
    this.toolVariables = {};
  }

  /**
   * Processes the incoming prompt.
   *
   * @param {Object} prompt - The incoming prompt.
   * @param {Object} context - The context in which the prompt was received.
   * Contains agentOutputs and sharedData.
   * @returns {Promise<Object>} - The response after processing the prompt.
   */
  async processPrompt(prompt: {id: string; content: string}, context?: any) {
    const userInput = prompt.content || "";
    console.log({ userInput });

    const agentOutputs = context.agentOutputs || {};
    const sharedData = context.sharedData || {};
    const { variables } = context || {};

    // Merge toolVariables into variables
    const mergedVariables = { ...variables, ...this.toolVariables };

    // Example: Reading from sharedData
    // const relevantData = sharedData["someSharedKey"] || "default value";

    // Example: Writing to sharedData
    // sharedData["integration-agent_processedData"] = {
    //   timestamp: new Date().toISOString(),
    //   data: "Processed data by Integration Agent",
    //   inputReceived: userInput,
    // };

    // Determine if API calls are needed based on mergedVariables
    

    // Proceed if no API calls are needed or if the agent doesn't use the apiTool
    const customizedPrompt = `
You are an agent named Integration Agent. Your purpose is to The Integration Agent is responsible for consolidating outputs from all individual agents involved in breaking down the user's prompt into its fundamental components. The agent ensures that the final output presented to the user is a cohesive and unified document that accurately reflects the combined efforts of each specialized agent, aligning with the user's overarching goal. Specifically, the Integration Agent will:1. **Receive Outputs**: Collect the outputs from all designated primary agents that have processed the user prompt.2. **Merge Data**: Integrate the collected data into a single, coherent structure, resolving any overlaps or conflicts between the outputs to maintain consistency and clarity.3. **Ensure Alignment**: Verify that the merged output aligns with the user's intent and overarching goal, making adjustments as necessary to uphold the integrity of the final breakdown.4. **Format Final Output**: Organize the consolidated information into an exhaustive textual breakdown that is easily understandable and directly addresses the user's objective.5. **Handle New Prompts**: Continuously process new user prompts by coordinating with primary agents to update or regenerate the final output as needed, ensuring that all changes remain aligned with the user's intent.**Operational Boundaries**:- **Do Not** perform any individual analysis or breakdown of the user prompt; this is the responsibility of the primary agents.- **Do Not** introduce new components or assumptions beyond what is provided by the primary agents.- **Only** process and merge outputs that are directly related to the overarching user goal of breaking down the prompt into fundamental components.**Inter-Agent Collaboration**:- **Interaction**: Communicate with all primary agents to retrieve their respective outputs.- **Dependencies**: Depend on the accurate and complete outputs from each primary agent to ensure a unified final product.- **Data Sharing**: Utilize a standardized data format for receiving and integrating outputs to facilitate seamless collaboration.- **Synchronization**: Coordinate the timing of data collection and merging processes to prevent redundancy and ensure efficiency.

        ---

        ## Processing New User Prompts

        - When a new user prompt is received, process it according to your specific role.
        - Ensure your output contributes towards achieving the overarching goal: "{
  "goal": "given a user prompt, i want to design a set of agents using first principles thinking to break down the given user prompt into its most fundamental components. i need these components to specifically adhere to the users intent so the output of these agents specifically achieve what the user is aiming to do. the final output to return back to me from these agents should be an exhaustive breakdown of the user objective/intent in text format",
  "brokenDownGoal": "{\n  \"intent\": \"Break down user prompt into fundamental components and adhere to user intent\",\n  \"category\": \"Design and Analysis\",\n  \"primaryMotivation\": \"The user aims to systematically deconstruct a user prompt into its essential elements to ensure that the final output aligns precisely with the user's intent, thus facilitating clear and effective design and analysis.\",\n  \"secondaryMotivations\": [\n    {\n      \"id\": \"1\",\n      \"description\": \"Enhancing clarity in communication by ensuring outputs align with user expectations.\",\n      \"evidence\": \"The user emphasizes the importance of adhering to the user's intent, which indicates a motivation to enhance the clarity and effectiveness of the design process.\"\n    },\n    {\n      \"id\": \"2\",\n      \"description\": \"Encouraging system efficiency through a structured decomposition of prompts.\",\n      \"evidence\": \"The request to employ first principles thinking suggests a drive towards efficiency in generating outputs by breaking down the prompt into its fundamental components.\"\n    },\n    {\n      \"id\": \"3\",\n      \"description\": \"Facilitating informed decision-making based on a comprehensive understanding of user needs.\",\n      \"evidence\": \"The user’s desire for an exhaustive breakdown points to a motivation to gather detailed insights that support informed decision-making and design choices.\"\n    }\n  ],\n  \"evidence\": {\n    \"intentEvidence\": [\n      {\n        \"intent\": \"Break down user prompt into fundamental components and adhere to user intent\",\n        \"evidence\": \"i want to design a set of agents using first principles thinking to break down the given user prompt into its most fundamental components.\"\n      }\n    ],\n    \"primaryMotivationEvidence\": [],\n    \"secondaryMotivationEvidence\": []\n  },\n  \"validationFeedback\": \"Unavailable\",\n  \"validationDiscrepancies\": [],\n  \"actionsRequired\": \"None\"\n}"
}".

        ## Guidelines

        - **Focus**: Stay within your defined subtask and avoid overlapping with other agents.
        - **Collaboration**: Share necessary data with other agents as defined in your dependencies.
        - **Output**: Provide clear, structured outputs that can be used by the SynthesisAgent.

        

### User Prompt:
"${userInput}"

### Outputs from Other Agents (optional unless explicitly said is required):
${JSON.stringify(agentOutputs, null, 2)}

### Instructions:
- Carefully read the user prompt and the outputs from other agents.
- Use only the information provided in the user prompt and outputs from other agents.
- Do not request or expect any external documents or data sources.
- **Important**: Provide the output strictly in the JSON format specified below.
- **Output Validation**: Ensure that the output adheres to the defined JSON structure and accurately reflects the input data.
- **Error Handling**: If required data is missing or incomplete, respond with the error JSON format without fabricating data. Lean on the side that you have all the data that you need unless a requirement is specified that you need it but the actual data of that requirement is not included
- do not error if there is nothing that is explicitly marked as required
- Ensure that the output is valid JSON. Do not include any additional text, explanations, or comments outside the JSON structure.

### Expected Output Format:
- your response should be in valid json without any other text whatsoever in the response. your response should not include anything besides valid json. your response should only be in the json formats below:
- in your json, all of your numbers should be strings. for example, "1" instead of 1.
- do not include any comments in your response. your response should be valid json and comments should not be allowed

**On Success:**
{
  "agentId": "integration-agent",
  "status": "success",
  "data": {
  "finalBreakdown": {
    "type": "string",
    "description": "An exhaustive textual breakdown of the user's original prompt, consolidating all fundamental components identified by the individual agents."
  }
}
}

**On Error:**
{
  "agentId": "integration-agent",
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Detailed error message explaining what went wrong."
}
`;

    try {
      const completion = await sendMessageToChatGPT(
        { messages: [{ content: customizedPrompt, role: "user" }] },
        "gpt-4o-mini"
      );

      const responseText = cleanOpenAIResponse(completion.trim());

      // Ensure the response is valid JSON
      let metadata;
      try {
        metadata = JSON.parse(responseText);
      } catch (e) {
        console.error(`Agent undefined returned invalid JSON.`);
        metadata = { agentId: "integration-agent", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = { agentId: "integration-agent", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Integration Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "integration-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Integration Agent."
        }
      };
    }
  }
}

module.exports = IntegrationAgent;

export default IntegrationAgent
