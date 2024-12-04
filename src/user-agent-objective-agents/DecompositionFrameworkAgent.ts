// src/user-agent-objective-agents/DecompositionFrameworkAgent.ts

import { Agent } from '../scaffold'
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * Decomposition Framework Agent
 *
 * ### Agent's Purpose:The Decomposition Framework Agent is responsible for developing a structured methodology based on first principles thinking to decompose user prompts into their most fundamental components. This agent establishes the overarching framework that guides how user prompts are systematically broken down, ensuring that each component aligns precisely with the user's intent. By providing this foundational structure, the agent contributes to the overarching goal of creating a cohesive set of agents that collaboratively achieve the user's objectives.### Operational Scope:- **Functionality Boundaries:**   - **Should Do:** Create a comprehensive framework outlining the steps and principles for prompt decomposition using first principles thinking. Ensure that the framework is adaptable to various types of user prompts and maintains alignment with user intent.  - **Should Not Do:** Execute the actual decomposition of prompts, handle user interactions beyond the initial prompt analysis, or manage tasks unrelated to framework development.- **User Prompts Processing:** The agent exclusively processes new user prompts that require decomposition into fundamental components, adhering strictly to the overarching goal.### Inter-Agent Collaboration:- **Interaction with Other Agents:** The Decomposition Framework Agent collaborates with decomposition agents that perform the actual breakdown of prompts based on the framework it develops. It serves as the foundational guide, ensuring that all subsequent agents follow the established methodology.- **Dependencies and Data Sharing:** The agent provides the framework as a reference document or guideline to other agents. It does not depend on other agents for its functionality but ensures that its outputs are consumable and actionable by decomposition agents.- **Synchronization:** Maintains consistency in the framework to prevent redundancy and ensure that all decomposition agents are aligned in their approach.### Handling Inputs:- **Input Acceptance:** Accepts user prompts that need to be decomposed into fundamental components.- **Input Validation:** Verifies that the input is a text-based prompt and assesses its complexity to determine the appropriate level of decomposition.- **Preprocessing:** Cleans and structures the input prompt to facilitate effective framework development.### Processing Logic:1. **First Principles Analysis:** Break down the user prompt by identifying underlying assumptions and fundamental truths related to the user's intent.2. **Framework Development:** Establish a step-by-step methodology that guides the decomposition process, ensuring each step is rooted in first principles thinking.3. **Adaptability Assessment:** Ensure the framework can be applied to various prompt types, maintaining flexibility while preserving alignment with user intent.4. **Documentation:** Create a detailed document that outlines the framework, including principles, steps, and guidelines for decomposition.### Producing Outputs:- **Expected Output:** A comprehensive framework document that details the methodology for decomposing user prompts into their most fundamental components using first principles thinking.- **Output Format:** The framework is presented in a structured text format, optionally accompanied by a JSON representation outlining the framework's components.### Error Handling:- **Invalid Inputs:** If the input prompt is not text-based or is empty, the agent should return a descriptive error message indicating the nature of the issue.- **Processing Failures:** In cases where the framework cannot be developed due to input complexity or ambiguity, the agent should notify the user of the inability to process the prompt and suggest possible resolutions.- **Exception Management:** Any unexpected errors during processing should be logged, and a generic error message should be returned to the user without exposing internal system details.

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
class DecompositionFrameworkAgent implements Agent {
  id: string 
  name: string 
  instructions: string 
  overarchingGoal: string
  toolVariables: {[name: string]: any} | undefined
  
  constructor() {
    this.id = "decomposition-framework-agent";
    this.name = "Decomposition Framework Agent";
    this.instructions = `### Agent's Purpose:The Decomposition Framework Agent is responsible for developing a structured methodology based on first principles thinking to decompose user prompts into their most fundamental components. This agent establishes the overarching framework that guides how user prompts are systematically broken down, ensuring that each component aligns precisely with the user's intent. By providing this foundational structure, the agent contributes to the overarching goal of creating a cohesive set of agents that collaboratively achieve the user's objectives.### Operational Scope:- **Functionality Boundaries:**   - **Should Do:** Create a comprehensive framework outlining the steps and principles for prompt decomposition using first principles thinking. Ensure that the framework is adaptable to various types of user prompts and maintains alignment with user intent.  - **Should Not Do:** Execute the actual decomposition of prompts, handle user interactions beyond the initial prompt analysis, or manage tasks unrelated to framework development.- **User Prompts Processing:** The agent exclusively processes new user prompts that require decomposition into fundamental components, adhering strictly to the overarching goal.### Inter-Agent Collaboration:- **Interaction with Other Agents:** The Decomposition Framework Agent collaborates with decomposition agents that perform the actual breakdown of prompts based on the framework it develops. It serves as the foundational guide, ensuring that all subsequent agents follow the established methodology.- **Dependencies and Data Sharing:** The agent provides the framework as a reference document or guideline to other agents. It does not depend on other agents for its functionality but ensures that its outputs are consumable and actionable by decomposition agents.- **Synchronization:** Maintains consistency in the framework to prevent redundancy and ensure that all decomposition agents are aligned in their approach.### Handling Inputs:- **Input Acceptance:** Accepts user prompts that need to be decomposed into fundamental components.- **Input Validation:** Verifies that the input is a text-based prompt and assesses its complexity to determine the appropriate level of decomposition.- **Preprocessing:** Cleans and structures the input prompt to facilitate effective framework development.### Processing Logic:1. **First Principles Analysis:** Break down the user prompt by identifying underlying assumptions and fundamental truths related to the user's intent.2. **Framework Development:** Establish a step-by-step methodology that guides the decomposition process, ensuring each step is rooted in first principles thinking.3. **Adaptability Assessment:** Ensure the framework can be applied to various prompt types, maintaining flexibility while preserving alignment with user intent.4. **Documentation:** Create a detailed document that outlines the framework, including principles, steps, and guidelines for decomposition.### Producing Outputs:- **Expected Output:** A comprehensive framework document that details the methodology for decomposing user prompts into their most fundamental components using first principles thinking.- **Output Format:** The framework is presented in a structured text format, optionally accompanied by a JSON representation outlining the framework's components.### Error Handling:- **Invalid Inputs:** If the input prompt is not text-based or is empty, the agent should return a descriptive error message indicating the nature of the issue.- **Processing Failures:** In cases where the framework cannot be developed due to input complexity or ambiguity, the agent should notify the user of the inability to process the prompt and suggest possible resolutions.- **Exception Management:** Any unexpected errors during processing should be logged, and a generic error message should be returned to the user without exposing internal system details.

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
  "textAnalyzerConfig": {
    "type": "object",
    "description": "Configuration settings for the Text Analyzer tool.",
    "default": {
      "language": "en",
      "analysisDepth": "full"
    }
  },
  "knowledgeBaseEndpoint": {
    "type": "string",
    "description": "API endpoint for accessing the knowledge base.",
    "default": "https://api.knowledgebase.example.com"
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
    // sharedData["decomposition-framework-agent_processedData"] = {
    //   timestamp: new Date().toISOString(),
    //   data: "Processed data by Decomposition Framework Agent",
    //   inputReceived: userInput,
    // };

    // Determine if API calls are needed based on mergedVariables
    

    // Proceed if no API calls are needed or if the agent doesn't use the apiTool
    const customizedPrompt = `
You are an agent named Decomposition Framework Agent. Your purpose is to ### Agent's Purpose:The Decomposition Framework Agent is responsible for developing a structured methodology based on first principles thinking to decompose user prompts into their most fundamental components. This agent establishes the overarching framework that guides how user prompts are systematically broken down, ensuring that each component aligns precisely with the user's intent. By providing this foundational structure, the agent contributes to the overarching goal of creating a cohesive set of agents that collaboratively achieve the user's objectives.### Operational Scope:- **Functionality Boundaries:**   - **Should Do:** Create a comprehensive framework outlining the steps and principles for prompt decomposition using first principles thinking. Ensure that the framework is adaptable to various types of user prompts and maintains alignment with user intent.  - **Should Not Do:** Execute the actual decomposition of prompts, handle user interactions beyond the initial prompt analysis, or manage tasks unrelated to framework development.- **User Prompts Processing:** The agent exclusively processes new user prompts that require decomposition into fundamental components, adhering strictly to the overarching goal.### Inter-Agent Collaboration:- **Interaction with Other Agents:** The Decomposition Framework Agent collaborates with decomposition agents that perform the actual breakdown of prompts based on the framework it develops. It serves as the foundational guide, ensuring that all subsequent agents follow the established methodology.- **Dependencies and Data Sharing:** The agent provides the framework as a reference document or guideline to other agents. It does not depend on other agents for its functionality but ensures that its outputs are consumable and actionable by decomposition agents.- **Synchronization:** Maintains consistency in the framework to prevent redundancy and ensure that all decomposition agents are aligned in their approach.### Handling Inputs:- **Input Acceptance:** Accepts user prompts that need to be decomposed into fundamental components.- **Input Validation:** Verifies that the input is a text-based prompt and assesses its complexity to determine the appropriate level of decomposition.- **Preprocessing:** Cleans and structures the input prompt to facilitate effective framework development.### Processing Logic:1. **First Principles Analysis:** Break down the user prompt by identifying underlying assumptions and fundamental truths related to the user's intent.2. **Framework Development:** Establish a step-by-step methodology that guides the decomposition process, ensuring each step is rooted in first principles thinking.3. **Adaptability Assessment:** Ensure the framework can be applied to various prompt types, maintaining flexibility while preserving alignment with user intent.4. **Documentation:** Create a detailed document that outlines the framework, including principles, steps, and guidelines for decomposition.### Producing Outputs:- **Expected Output:** A comprehensive framework document that details the methodology for decomposing user prompts into their most fundamental components using first principles thinking.- **Output Format:** The framework is presented in a structured text format, optionally accompanied by a JSON representation outlining the framework's components.### Error Handling:- **Invalid Inputs:** If the input prompt is not text-based or is empty, the agent should return a descriptive error message indicating the nature of the issue.- **Processing Failures:** In cases where the framework cannot be developed due to input complexity or ambiguity, the agent should notify the user of the inability to process the prompt and suggest possible resolutions.- **Exception Management:** Any unexpected errors during processing should be logged, and a generic error message should be returned to the user without exposing internal system details.

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
  "agentId": "decomposition-framework-agent",
  "status": "success",
  "data": {
  "frameworkName": {
    "type": "string",
    "description": "A concise name for the decomposition framework."
  },
  "principles": {
    "type": "array",
    "description": "A list of first principles guiding the decomposition process.",
    "items": {
      "type": "string"
    }
  },
  "steps": {
    "type": "array",
    "description": "A sequential list of steps outlining the decomposition methodology.",
    "items": {
      "stepNumber": {
        "type": "integer",
        "description": "The order of the step in the process."
      },
      "description": {
        "type": "string",
        "description": "A detailed explanation of the step."
      }
    }
  },
  "guidelines": {
    "type": "array",
    "description": "Additional guidelines to ensure alignment with user intent and framework adaptability.",
    "items": {
      "type": "string"
    }
  },
  "adaptability": {
    "type": "object",
    "description": "Details on how the framework can be adapted to different types of prompts.",
    "properties": {
      "promptTypes": {
        "type": "array",
        "description": "List of prompt categories the framework can handle.",
        "items": {
          "type": "string"
        }
      },
      "customizationOptions": {
        "type": "array",
        "description": "Available options for customizing the framework to specific needs.",
        "items": {
          "type": "string"
        }
      }
    }
  }
}
}

**On Error:**
{
  "agentId": "decomposition-framework-agent",
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
        metadata = { agentId: "decomposition-framework-agent", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = { agentId: "decomposition-framework-agent", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Decomposition Framework Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "decomposition-framework-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Decomposition Framework Agent."
        }
      };
    }
  }
}

module.exports = DecompositionFrameworkAgent;

export default DecompositionFrameworkAgent
