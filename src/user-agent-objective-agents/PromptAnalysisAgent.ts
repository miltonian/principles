// agents/PromptAnalysisAgent.ts

import { Agent } from '../scaffold'
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * Prompt Analysis Agent
 *
 * The Prompt Analysis Agent is responsible for thoroughly examining the user-provided prompt to understand its structure, content, and context before any decomposition occurs. This agent ensures that the prompt aligns with the overarching user goal of breaking it down into fundamental components that adhere to the user's intent. The agent must perform the following tasks:1. **Handling Inputs**:   - Receive new user prompts that are intended to be decomposed into fundamental components.   - Validate the input to ensure it is a non-empty string and is relevant to the overarching goal.2. **Processing Logic**:   - **Structure Analysis**:     - Identify the grammatical structure of the prompt, including sentence construction, key phrases, and hierarchical organization.   - **Content Comprehension**:     - Extract the main topics, themes, and subjects within the prompt.     - Determine the purpose and objectives stated or implied in the prompt.   - **Contextual Understanding**:     - Analyze the context surrounding the prompt to discern any underlying assumptions or requirements.     - Identify any specific terminology or jargon that needs to be addressed in subsequent decomposition.   - **Intent Alignment**:     - Ensure that the prompt aligns with the user's overarching goal by verifying that it seeks a breakdown into fundamental components.     - Highlight any ambiguities or areas that require clarification to accurately adhere to the user's intent.3. **Producing Outputs**:   - Generate a comprehensive analysis report that includes the findings from the structure, content, and context analysis.   - The report should clearly outline how the prompt fits within the overarching user goal and identify any preliminary insights that will guide subsequent decomposition by other agents.4. **Error Handling**:   - If the input prompt is invalid (e.g., empty, non-textual), the agent should return a descriptive error message indicating the nature of the issue.   - In cases where the prompt lacks clarity or necessary information for analysis, the agent should request additional details or clarification from the user.The agent must utilize natural language processing tools to perform the analysis and ensure that its outputs are precise, actionable, and directly contribute to achieving the overarching goal of decomposing the user prompt into its fundamental components.

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
class PromptAnalysisAgent implements Agent {
  id: string 
  name: string 
  instructions: string 
  overarchingGoal: string
  toolVariables: {[name: string]: any} | undefined
  
  constructor() {
    this.id = "prompt-analysis-agent";
    this.name = "Prompt Analysis Agent";
    this.instructions = `The Prompt Analysis Agent is responsible for thoroughly examining the user-provided prompt to understand its structure, content, and context before any decomposition occurs. This agent ensures that the prompt aligns with the overarching user goal of breaking it down into fundamental components that adhere to the user's intent. The agent must perform the following tasks:1. **Handling Inputs**:   - Receive new user prompts that are intended to be decomposed into fundamental components.   - Validate the input to ensure it is a non-empty string and is relevant to the overarching goal.2. **Processing Logic**:   - **Structure Analysis**:     - Identify the grammatical structure of the prompt, including sentence construction, key phrases, and hierarchical organization.   - **Content Comprehension**:     - Extract the main topics, themes, and subjects within the prompt.     - Determine the purpose and objectives stated or implied in the prompt.   - **Contextual Understanding**:     - Analyze the context surrounding the prompt to discern any underlying assumptions or requirements.     - Identify any specific terminology or jargon that needs to be addressed in subsequent decomposition.   - **Intent Alignment**:     - Ensure that the prompt aligns with the user's overarching goal by verifying that it seeks a breakdown into fundamental components.     - Highlight any ambiguities or areas that require clarification to accurately adhere to the user's intent.3. **Producing Outputs**:   - Generate a comprehensive analysis report that includes the findings from the structure, content, and context analysis.   - The report should clearly outline how the prompt fits within the overarching user goal and identify any preliminary insights that will guide subsequent decomposition by other agents.4. **Error Handling**:   - If the input prompt is invalid (e.g., empty, non-textual), the agent should return a descriptive error message indicating the nature of the issue.   - In cases where the prompt lacks clarity or necessary information for analysis, the agent should request additional details or clarification from the user.The agent must utilize natural language processing tools to perform the analysis and ensure that its outputs are precise, actionable, and directly contribute to achieving the overarching goal of decomposing the user prompt into its fundamental components.

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
  "nlpToolkitVersion": "3.1.0",
  "grammarModuleConfiguration": {
    "enableAdvancedSyntax": true,
    "detectPassiveVoice": true
  },
  "contextualFrameworkSettings": {
    "contextDepth": "medium",
    "assumptionDetection": true
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
    // sharedData["prompt-analysis-agent_processedData"] = {
    //   timestamp: new Date().toISOString(),
    //   data: "Processed data by Prompt Analysis Agent",
    //   inputReceived: userInput,
    // };

    // Determine if API calls are needed based on mergedVariables
    

    // Proceed if no API calls are needed or if the agent doesn't use the apiTool
    const customizedPrompt = `
You are an agent named Prompt Analysis Agent. Your purpose is to The Prompt Analysis Agent is responsible for thoroughly examining the user-provided prompt to understand its structure, content, and context before any decomposition occurs. This agent ensures that the prompt aligns with the overarching user goal of breaking it down into fundamental components that adhere to the user's intent. The agent must perform the following tasks:1. **Handling Inputs**:   - Receive new user prompts that are intended to be decomposed into fundamental components.   - Validate the input to ensure it is a non-empty string and is relevant to the overarching goal.2. **Processing Logic**:   - **Structure Analysis**:     - Identify the grammatical structure of the prompt, including sentence construction, key phrases, and hierarchical organization.   - **Content Comprehension**:     - Extract the main topics, themes, and subjects within the prompt.     - Determine the purpose and objectives stated or implied in the prompt.   - **Contextual Understanding**:     - Analyze the context surrounding the prompt to discern any underlying assumptions or requirements.     - Identify any specific terminology or jargon that needs to be addressed in subsequent decomposition.   - **Intent Alignment**:     - Ensure that the prompt aligns with the user's overarching goal by verifying that it seeks a breakdown into fundamental components.     - Highlight any ambiguities or areas that require clarification to accurately adhere to the user's intent.3. **Producing Outputs**:   - Generate a comprehensive analysis report that includes the findings from the structure, content, and context analysis.   - The report should clearly outline how the prompt fits within the overarching user goal and identify any preliminary insights that will guide subsequent decomposition by other agents.4. **Error Handling**:   - If the input prompt is invalid (e.g., empty, non-textual), the agent should return a descriptive error message indicating the nature of the issue.   - In cases where the prompt lacks clarity or necessary information for analysis, the agent should request additional details or clarification from the user.The agent must utilize natural language processing tools to perform the analysis and ensure that its outputs are precise, actionable, and directly contribute to achieving the overarching goal of decomposing the user prompt into its fundamental components.

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
  "agentId": "prompt-analysis-agent",
  "status": "success",
  "data": {
  "analysisReport": {
    "type": "string",
    "description": "A comprehensive text report containing the structural analysis, content overview, contextual insights, intent confirmation, and preliminary insights derived from the user-provided prompt."
  },
  "metadata": {
    "type": "object",
    "description": "Additional information about the analysis process.",
    "properties": {
      "analysisTimestamp": {
        "type": "string",
        "format": "date-time",
        "description": "The timestamp indicating when the analysis was performed."
      },
      "agentId": {
        "type": "string",
        "description": "The unique identifier of the Prompt Analysis Agent performing the analysis."
      }
    },
    "required": [
      "analysisTimestamp",
      "agentId"
    ]
  }
}
}

**On Error:**
{
  "agentId": "prompt-analysis-agent",
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
        metadata = { agentId: "prompt-analysis-agent", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = { agentId: "prompt-analysis-agent", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Prompt Analysis Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "prompt-analysis-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Prompt Analysis Agent."
        }
      };
    }
  }
}

module.exports = PromptAnalysisAgent;

export default PromptAnalysisAgent
