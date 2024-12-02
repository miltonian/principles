// src/templates/GenericAgentTemplate.ts

/**
 * Template for creating a Generic Primary Agent class.
 *
 * @param {Object} config - Configuration object for the agent.
 * @param {string} config.className - The name of the agent class.
 * @param {string} config.id - Unique identifier for the agent.
 * @param {string} config.name - Human-readable name of the agent.
 * @param {string} config.instructions - Instructions describing the agent's purpose.
 * @param {string} config.expectedOutput - Description of the expected output from the agent.
 * @param {Object} config.outputFormat - The JSON structure for the agent's output.
 * @param {Array<string>} config.tools - Array of tool names the agent requires.
 * @param {Object} config.toolVariables - Variables needed for the tools.
 * @returns {string} - The generated Primary Agent class code.
 */
export function generatePrimaryAgent(config: {
  className: string;
  id: string;
  name: string;
  instructions: string;
  outputFormat: any;
  tools: string[];
  toolVariables: { [name: string]: any };
  overarchingGoal: string;
}) {
  const {
    className,
    id,
    name,
    instructions,
    outputFormat,
    tools,
    toolVariables,
    overarchingGoal,
  } = config;

  // Prepare tool imports
  let toolImports = "";
  if (tools && tools.includes("apiTool")) {
    toolImports += `import { ApiTool }  from "../utils/apiTool";\n`;
  }
  // Add imports for other tools as needed

  // Prepare tool initializations
  let toolInitializations = "";
  if (tools && tools.includes("apiTool")) {
    toolInitializations += `this.apiTool = new ApiTool();\n`;
  }
  // Initialize other tools as needed

  return `// agents/${className}.ts
import { Agent } from "../scaffold";
${toolImports}
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * ${name}
 *
 * ${instructions}
 */
export class ${className} implements Agent {
  id: string;
  name: string;
  instructions: string;
  overarchingGoal: string;
  toolVariables: {[name: string]: any} | undefined
  
  constructor() {
    this.id = "${id}";
    this.name = "${name}";
    this.instructions = \`${instructions.replace(/`/g, "\\`")}\`;
    this.overarchingGoal = \`${overarchingGoal}\`;

    // Initialize tools
    ${toolInitializations}

    // Initialize tool variables
    this.toolVariables = ${JSON.stringify(toolVariables || {}, null, 2)};
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
    // sharedData["${id}_processedData"] = {
    //   timestamp: new Date().toISOString(),
    //   data: "Processed data by ${name}",
    //   inputReceived: userInput,
    // };

    // Determine if API calls are needed based on mergedVariables
    ${
      tools && tools.includes("apiTool")
        ? `
    if (mergedVariables.apiCallsNeeded) {
      try {
        // Use the API tool to make API calls
        const apiResponses = [];

        for (const apiCall of mergedVariables.apiCalls) {
          const { baseUrl, endpoint, method, headers, params, data } = apiCall;
          const response = await this.apiTool.callApi(
            baseUrl,
            endpoint,
            method,
            headers,
            params,
            data
          );
          apiResponses.push(response);
        }

        // Process the API responses as needed
        const customizedPrompt = \`
          You are an agent named ${name}. Your purpose is to ${instructions}

          ### User Prompt:
          "\${userInput}"

          ### Shared Data:
          \${JSON.stringify(sharedData, null, 2)}

          ### Outputs from Other Agents:
          \${JSON.stringify(agentOutputs, null, 2)}

          ### Instructions:
          - Carefully read the user prompt and the outputs from other agents.
          - Use only the information provided in the user prompt, sharedData, and outputs from other agents.
          - Do not request or expect any external documents or data sources.
          - **Important**: Provide the output strictly in the JSON format specified below.
          - **Output Validation**: Ensure that the output adheres to the defined JSON structure and accurately reflects the input data.
          - **Error Handling**: If required data is missing or incomplete, respond with the error JSON format without fabricating data. Lean on the side that you have all the data that you need unless a requirement is specified that you need it but the actual data of that requirement is not included.
          - Do not error if there is nothing that is explicitly marked as required.
          - Ensure that the output is valid JSON. Do not include any additional text, explanations, or comments outside the JSON structure.

          **Output Format Requirement**:

          - Your response **must be a single valid JSON object** that adheres exactly to the structure specified below.
          - **Do not include any additional text, comments, or explanations** outside of the JSON object.
          - **Ensure** that the JSON is **properly formatted** and **valid**.

          **Expected JSON Structure**:
          - Your response should be in valid JSON without any other text whatsoever in the response. Your response should not include anything besides valid JSON. Your response should only be in the JSON formats below:
          - your response should be in valid json without any other text whatsoever in the response. your response should not include anything besides valid json. your response should only be in the json formats below:
          - in your json, all of your numbers should be strings. for example, "1" instead of 1.
          - do not include any comments in your response. your response should be valid json and comments should not be allowed

          **On Success:**
          {
            "agentId": "${id}",
            "status": "success",
            "data": ${JSON.stringify(outputFormat, null, 2)}
          }

          **On Error:**
          {
            "agentId": "${id}",
            "status": "error",
            "code": "ERROR_CODE",
            "message": "Detailed error message explaining what went wrong."
          }
        \`;

        let attempts = 0;
        const maxAttempts = 3;
        let validJSON = false;
        let responseText = '';

        while (!validJSON && attempts < maxAttempts) {
          attempts++;
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
              validJSON = true
            } catch (e) {
              console.error(\`Agent \${this.id} returned invalid JSON.\`);
              metadata = { agentId: "${id}", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
            }

            // Validate presence of required fields
            if (!metadata.agentId || !metadata.status) {
              console.error(\`Agent \${this.id} returned incomplete data.\`);
              metadata = { agentId: "${id}", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
            }

            console.log({ completion, metadata });
            return {
              promptId: prompt.id,
              content: "", // No content to return at this stage
              metadata: metadata,
            };
          } catch (error) {
            customizedPrompt += \`

              **Attention**: The previous response was invalid JSON. Please ensure that your response is a **single valid JSON object**, without any additional text or comments.

              **Retry Attempt \${attempts} of \${maxAttempts}**
            \`;
            
            // If max attempts reached, return an error
            if (attempts >= maxAttempts) {
              console.error(\`Failed to get valid JSON after \${maxAttempts} attempts.\`);
              return {
                promptId: prompt.id,
                content: "",
                metadata: {
                  agentId: this.id,
                  status: "error",
                  code: "INVALID_JSON",
                  message: \`Failed to get valid JSON after \${maxAttempts} attempts.\`,
                },
              };
            }
          }
        }
      } catch (error) {
        console.error(\`Error in ${name} while making API calls:\`, error.message);
        return {
          promptId: prompt.id,
          content: "",
          metadata: {
            agentId: "${id}",
            status: "error",
            code: "API_CALL_FAILED",
            message: error.message,
          },
        };
      }
    }
    `
        : ""
    }

    // Proceed if no API calls are needed or if the agent doesn't use the apiTool
    const customizedPrompt = \`
    You are an agent named ${name}. Your purpose is to ${instructions}

    ### User Prompt:
    "\${userInput}"

    ### Outputs from Other Agents (optional unless explicitly said is required):
    \${JSON.stringify(agentOutputs, null, 2)}

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
      "agentId": "${id}",
      "status": "success",
      "data": ${JSON.stringify(outputFormat, null, 2)}
    }

    **On Error:**
    {
      "agentId": "${id}",
      "status": "error",
      "code": "ERROR_CODE",
      "message": "Detailed error message explaining what went wrong."
    }
    \`;

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
        console.error(\`Agent \${this.id} returned invalid JSON.\`);
        metadata = { agentId: "${id}", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(\`Agent \${this.id} returned incomplete data.\`);
        metadata = { agentId: "${id}", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(\`Error in ${name}:\`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "${id}",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in ${name}."
        }
      };
    }
  }
}

export default ${className};


`;
}
