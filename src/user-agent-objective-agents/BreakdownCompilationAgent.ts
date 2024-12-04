// src/user-agent-objective-agents/BreakdownCompilationAgent.ts

import { Agent } from '../scaffold';
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * Breakdown Compilation Agent
 *
 * The Breakdown Compilation Agent is responsible for aggregating all identified and verified fundamental components related to the user's prompt. It compiles these components into a comprehensive and detailed textual breakdown that accurately reflects the user's objectives and intents. This agent ensures that the final output aligns with the overarching user goal by meticulously organizing and presenting the components in a coherent and exhaustive manner.**Handling Inputs**: The agent receives processed outputs from primary agents responsible for identifying and validating fundamental components of the user's prompt. These inputs are typically structured data representing different aspects of the user's intent.**Processing Logic**:1. **Data Aggregation**: Collect all inputs from the primary agents.2. **Validation**: Verify the completeness and consistency of the received components.3. **Synthesis**: Integrate the components into a unified structure, ensuring logical flow and coherence.4. **Textual Compilation**: Convert the synthesized structure into a detailed textual breakdown, emphasizing the alignment with the user's objectives.**Producing Outputs**: The agent outputs a well-structured text that provides an exhaustive breakdown of the user's objectives and intents, ensuring that all fundamental components are accurately represented and organized.**Error Handling**: In cases where inputs from primary agents are missing, inconsistent, or incomplete, the agent should flag the specific issues and either request the necessary adjustments from the respective agents or provide a summary of the encountered problems in the output.

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
class BreakdownCompilationAgent implements Agent {
  id: string 
  name: string 
  instructions: string 
  overarchingGoal: string
  toolVariables: {[name: string]: any} | undefined
  
  constructor() {
    this.id = "breakdown-compilation-agent";
    this.name = "Breakdown Compilation Agent";
    this.instructions = `The Breakdown Compilation Agent is responsible for aggregating all identified and verified fundamental components related to the user's prompt. It compiles these components into a comprehensive and detailed textual breakdown that accurately reflects the user's objectives and intents. This agent ensures that the final output aligns with the overarching user goal by meticulously organizing and presenting the components in a coherent and exhaustive manner.**Handling Inputs**: The agent receives processed outputs from primary agents responsible for identifying and validating fundamental components of the user's prompt. These inputs are typically structured data representing different aspects of the user's intent.**Processing Logic**:1. **Data Aggregation**: Collect all inputs from the primary agents.2. **Validation**: Verify the completeness and consistency of the received components.3. **Synthesis**: Integrate the components into a unified structure, ensuring logical flow and coherence.4. **Textual Compilation**: Convert the synthesized structure into a detailed textual breakdown, emphasizing the alignment with the user's objectives.**Producing Outputs**: The agent outputs a well-structured text that provides an exhaustive breakdown of the user's objectives and intents, ensuring that all fundamental components are accurately represented and organized.**Error Handling**: In cases where inputs from primary agents are missing, inconsistent, or incomplete, the agent should flag the specific issues and either request the necessary adjustments from the respective agents or provide a summary of the encountered problems in the output.

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
    this.toolVariables = {
  "TextAggregator": {
    "maxComponents": 50,
    "aggregationMethod": "sequential"
  },
  "SyntaxFormatter": {
    "language": "English",
    "formatStyle": "detailed"
  }
};
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
    // sharedData["breakdown-compilation-agent_processedData"] = {
    //   timestamp: new Date().toISOString(),
    //   data: "Processed data by Breakdown Compilation Agent",
    //   inputReceived: userInput,
    // };

    // Determine if API calls are needed based on mergedVariables
    

    // Proceed if no API calls are needed or if the agent doesn't use the apiTool
    const customizedPrompt = `
You are an agent named Breakdown Compilation Agent. Your purpose is to The Breakdown Compilation Agent is responsible for aggregating all identified and verified fundamental components related to the user's prompt. It compiles these components into a comprehensive and detailed textual breakdown that accurately reflects the user's objectives and intents. This agent ensures that the final output aligns with the overarching user goal by meticulously organizing and presenting the components in a coherent and exhaustive manner.**Handling Inputs**: The agent receives processed outputs from primary agents responsible for identifying and validating fundamental components of the user's prompt. These inputs are typically structured data representing different aspects of the user's intent.**Processing Logic**:1. **Data Aggregation**: Collect all inputs from the primary agents.2. **Validation**: Verify the completeness and consistency of the received components.3. **Synthesis**: Integrate the components into a unified structure, ensuring logical flow and coherence.4. **Textual Compilation**: Convert the synthesized structure into a detailed textual breakdown, emphasizing the alignment with the user's objectives.**Producing Outputs**: The agent outputs a well-structured text that provides an exhaustive breakdown of the user's objectives and intents, ensuring that all fundamental components are accurately represented and organized.**Error Handling**: In cases where inputs from primary agents are missing, inconsistent, or incomplete, the agent should flag the specific issues and either request the necessary adjustments from the respective agents or provide a summary of the encountered problems in the output.

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
  "agentId": "breakdown-compilation-agent",
  "status": "success",
  "data": {
  "breakdown": {
    "type": "string",
    "description": "An exhaustive textual representation of the user's objectives and intents, combining all fundamental components into a coherent narrative."
  }
}
}

**On Error:**
{
  "agentId": "breakdown-compilation-agent",
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
        metadata = { agentId: "breakdown-compilation-agent", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = { agentId: "breakdown-compilation-agent", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Breakdown Compilation Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "breakdown-compilation-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Breakdown Compilation Agent."
        }
      };
    }
  }
}

module.exports = BreakdownCompilationAgent;

export default BreakdownCompilationAgent
