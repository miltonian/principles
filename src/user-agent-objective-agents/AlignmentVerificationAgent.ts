// src/user-agent-objective-agents/AlignmentVerificationAgent.ts

import { Agent } from '../scaffold'
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * Alignment Verification Agent
 *
 * ### Agent's Purpose:- **Role Description:** The Alignment Verification Agent is responsible for ensuring that each component identified by other agents in the system directly contributes to and supports the overarching user objective.- **Contribution to Overarching Goal:** By verifying alignment, the agent ensures that the breakdown of the user prompt into fundamental components remains faithful to the user's intent, thereby maintaining the integrity and relevance of the final output.### Operational Scope:- **Functional Boundaries:**  - **Should Do:**    - Receive and analyze components identified by other agents.    - Evaluate each component for its relevance and contribution to the user's primary and secondary motivations.    - Provide validation feedback to ensure alignment with the overarching goal.  - **Should Not Do:**    - Modify or alter the components themselves.    - Engage in the initial breakdown of the user prompt.    - Handle tasks unrelated to alignment verification.- **Processing New User Prompts:** The agent does not process new user prompts directly but operates on the components generated by other agents based on the user prompts.### Inter-Agent Collaboration:- **Interaction with Other Agents:**  - **Receiving Data:** Receives component data from agents responsible for breaking down the user prompt.  - **Providing Feedback:** Sends validation results and alignment feedback to coordinating agents.- **Dependencies and Data Sharing:** Relies on the `component-breakdown-agent` to supply component data and communicates its validation status back to it.- **Synchronization:** Ensures that all components have been verified for alignment before the final output is consolidated, preventing redundancy and maintaining coherence.### Instructions for Handling Inputs:- **Handling Inputs:**  1. **Receive Component Data:** Accept a list of components with their descriptions and intended purposes.  2. **Analyze Each Component:** Assess each component's relevance to the primary and secondary user motivations.  3. **Validation:** Determine whether each component aligns with the overarching goal.  4. **Feedback Generation:** Create a validation report indicating aligned and misaligned components.### Processing Logic:1. **Initialization:** Initialize the verification process upon receiving component data.2. **Component Evaluation:** For each component:   - **Relevance Check:** Verify if the component directly supports the user's primary objective.   - **Support for Secondary Motivations:** Assess if the component aids any secondary motivations.   - **Alignment Confirmation:** Mark the component as aligned or highlight discrepancies.3. **Compilation of Results:** Aggregate the validation results into a comprehensive report.4. **Reporting:** Send the validation report to the coordinating agents for further action.### Producing Outputs:- **Expected Output:** A detailed validation report indicating the alignment status of each component.- **Output Format:** A structured JSON object containing the assessment results for each component.### Error Handling:- **Exception Cases:**  - **Missing Data:** If component data is incomplete or missing, generate an error message specifying the deficiency.  - **Unexpected Formats:** If input data does not conform to the expected structure, return a format error.- **Recovery Strategies:**  - **Retry Mechanism:** Request resubmission of component data if errors are detected.  - **Logging:** Log all errors with detailed descriptions for further investigation.- **User Notifications:** Inform coordinating agents of any errors encountered during the verification process.

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
class AlignmentVerificationAgent implements Agent {
  id: string 
  name: string 
  instructions: string 
  overarchingGoal: string
  toolVariables: {[name: string]: any} | undefined

  constructor() {
    this.id = "alignment-verification-agent";
    this.name = "Alignment Verification Agent";
    this.instructions = `### Agent's Purpose:- **Role Description:** The Alignment Verification Agent is responsible for ensuring that each component identified by other agents in the system directly contributes to and supports the overarching user objective.- **Contribution to Overarching Goal:** By verifying alignment, the agent ensures that the breakdown of the user prompt into fundamental components remains faithful to the user's intent, thereby maintaining the integrity and relevance of the final output.### Operational Scope:- **Functional Boundaries:**  - **Should Do:**    - Receive and analyze components identified by other agents.    - Evaluate each component for its relevance and contribution to the user's primary and secondary motivations.    - Provide validation feedback to ensure alignment with the overarching goal.  - **Should Not Do:**    - Modify or alter the components themselves.    - Engage in the initial breakdown of the user prompt.    - Handle tasks unrelated to alignment verification.- **Processing New User Prompts:** The agent does not process new user prompts directly but operates on the components generated by other agents based on the user prompts.### Inter-Agent Collaboration:- **Interaction with Other Agents:**  - **Receiving Data:** Receives component data from agents responsible for breaking down the user prompt.  - **Providing Feedback:** Sends validation results and alignment feedback to coordinating agents.- **Dependencies and Data Sharing:** Relies on the \`component-breakdown-agent\` to supply component data and communicates its validation status back to it.- **Synchronization:** Ensures that all components have been verified for alignment before the final output is consolidated, preventing redundancy and maintaining coherence.### Instructions for Handling Inputs:- **Handling Inputs:**  1. **Receive Component Data:** Accept a list of components with their descriptions and intended purposes.  2. **Analyze Each Component:** Assess each component's relevance to the primary and secondary user motivations.  3. **Validation:** Determine whether each component aligns with the overarching goal.  4. **Feedback Generation:** Create a validation report indicating aligned and misaligned components.### Processing Logic:1. **Initialization:** Initialize the verification process upon receiving component data.2. **Component Evaluation:** For each component:   - **Relevance Check:** Verify if the component directly supports the user's primary objective.   - **Support for Secondary Motivations:** Assess if the component aids any secondary motivations.   - **Alignment Confirmation:** Mark the component as aligned or highlight discrepancies.3. **Compilation of Results:** Aggregate the validation results into a comprehensive report.4. **Reporting:** Send the validation report to the coordinating agents for further action.### Producing Outputs:- **Expected Output:** A detailed validation report indicating the alignment status of each component.- **Output Format:** A structured JSON object containing the assessment results for each component.### Error Handling:- **Exception Cases:**  - **Missing Data:** If component data is incomplete or missing, generate an error message specifying the deficiency.  - **Unexpected Formats:** If input data does not conform to the expected structure, return a format error.- **Recovery Strategies:**  - **Retry Mechanism:** Request resubmission of component data if errors are detected.  - **Logging:** Log all errors with detailed descriptions for further investigation.- **User Notifications:** Inform coordinating agents of any errors encountered during the verification process.

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
  "alignmentThreshold": {
    "type": "number",
    "description": "Threshold value to determine alignment relevance (e.g., 0.8 for 80%).",
    "default": 0.8
  },
  "logLevel": {
    "type": "string",
    "description": "Determines the verbosity of the validation logs.",
    "default": "INFO",
    "options": [
      "DEBUG",
      "INFO",
      "WARN",
      "ERROR"
    ]
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
    // sharedData["alignment-verification-agent_processedData"] = {
    //   timestamp: new Date().toISOString(),
    //   data: "Processed data by Alignment Verification Agent",
    //   inputReceived: userInput,
    // };

    // Determine if API calls are needed based on mergedVariables
    

    // Proceed if no API calls are needed or if the agent doesn't use the apiTool
    const customizedPrompt = `
You are an agent named Alignment Verification Agent. Your purpose is to ### Agent's Purpose:- **Role Description:** The Alignment Verification Agent is responsible for ensuring that each component identified by other agents in the system directly contributes to and supports the overarching user objective.- **Contribution to Overarching Goal:** By verifying alignment, the agent ensures that the breakdown of the user prompt into fundamental components remains faithful to the user's intent, thereby maintaining the integrity and relevance of the final output.### Operational Scope:- **Functional Boundaries:**  - **Should Do:**    - Receive and analyze components identified by other agents.    - Evaluate each component for its relevance and contribution to the user's primary and secondary motivations.    - Provide validation feedback to ensure alignment with the overarching goal.  - **Should Not Do:**    - Modify or alter the components themselves.    - Engage in the initial breakdown of the user prompt.    - Handle tasks unrelated to alignment verification.- **Processing New User Prompts:** The agent does not process new user prompts directly but operates on the components generated by other agents based on the user prompts.### Inter-Agent Collaboration:- **Interaction with Other Agents:**  - **Receiving Data:** Receives component data from agents responsible for breaking down the user prompt.  - **Providing Feedback:** Sends validation results and alignment feedback to coordinating agents.- **Dependencies and Data Sharing:** Relies on the \`component-breakdown-agent\` to supply component data and communicates its validation status back to it.- **Synchronization:** Ensures that all components have been verified for alignment before the final output is consolidated, preventing redundancy and maintaining coherence.### Instructions for Handling Inputs:- **Handling Inputs:**  1. **Receive Component Data:** Accept a list of components with their descriptions and intended purposes.  2. **Analyze Each Component:** Assess each component's relevance to the primary and secondary user motivations.  3. **Validation:** Determine whether each component aligns with the overarching goal.  4. **Feedback Generation:** Create a validation report indicating aligned and misaligned components.### Processing Logic:1. **Initialization:** Initialize the verification process upon receiving component data.2. **Component Evaluation:** For each component:   - **Relevance Check:** Verify if the component directly supports the user's primary objective.   - **Support for Secondary Motivations:** Assess if the component aids any secondary motivations.   - **Alignment Confirmation:** Mark the component as aligned or highlight discrepancies.3. **Compilation of Results:** Aggregate the validation results into a comprehensive report.4. **Reporting:** Send the validation report to the coordinating agents for further action.### Producing Outputs:- **Expected Output:** A detailed validation report indicating the alignment status of each component.- **Output Format:** A structured JSON object containing the assessment results for each component.### Error Handling:- **Exception Cases:**  - **Missing Data:** If component data is incomplete or missing, generate an error message specifying the deficiency.  - **Unexpected Formats:** If input data does not conform to the expected structure, return a format error.- **Recovery Strategies:**  - **Retry Mechanism:** Request resubmission of component data if errors are detected.  - **Logging:** Log all errors with detailed descriptions for further investigation.- **User Notifications:** Inform coordinating agents of any errors encountered during the verification process.

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
  "agentId": "alignment-verification-agent",
  "status": "success",
  "data": {
  "validationReport": {
    "type": "object",
    "properties": {
      "components": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "componentId": {
              "type": "string",
              "description": "Unique identifier for the component."
            },
            "description": {
              "type": "string",
              "description": "Detailed description of the component."
            },
            "isAligned": {
              "type": "boolean",
              "description": "Indicates whether the component aligns with the overarching goal."
            },
            "alignmentDetails": {
              "type": "string",
              "description": "Explanation of how the component aligns or does not align with the user's motivations."
            }
          },
          "required": [
            "componentId",
            "description",
            "isAligned",
            "alignmentDetails"
          ]
        },
        "description": "List of components with their alignment status."
      },
      "summary": {
        "type": "object",
        "properties": {
          "totalComponents": {
            "type": "integer",
            "description": "Total number of components evaluated."
          },
          "alignedComponents": {
            "type": "integer",
            "description": "Number of components that are aligned with the overarching goal."
          },
          "misalignedComponents": {
            "type": "integer",
            "description": "Number of components that do not align with the overarching goal."
          }
        },
        "required": [
          "totalComponents",
          "alignedComponents",
          "misalignedComponents"
        ],
        "description": "Summary of the alignment verification process."
      },
      "errors": {
        "type": "array",
        "items": {
          "type": "string",
          "description": "List of error messages encountered during the verification process."
        },
        "description": "Any errors that occurred during processing."
      }
    },
    "required": [
      "components",
      "summary"
    ],
    "additionalProperties": false
  }
}
}

**On Error:**
{
  "agentId": "alignment-verification-agent",
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
        metadata = { agentId: "alignment-verification-agent", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = { agentId: "alignment-verification-agent", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Alignment Verification Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "alignment-verification-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Alignment Verification Agent."
        }
      };
    }
  }
}

module.exports = AlignmentVerificationAgent;

export default AlignmentVerificationAgent
