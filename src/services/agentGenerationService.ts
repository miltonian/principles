// src/services/agentGenerationService.ts
import fs from 'fs';
import path from 'path';
import { sendMessageToChatGPT } from '../llms/openaiClient';
import { cleanOpenAIResponse } from '../utils/responseUtils';
import { escapeUnescapedBackticks } from '../utils/stringUtils';
import { generatePrimaryAgent } from '../templates/GenericAgentTemplate';
import { generateOrchestratorAgent } from '../templates/OrchestratorAgentTemplate';
import { Conversation } from '../types/llmTypes';

/**
 * Interface for Agent Configuration.
 */
interface AgentConfig {
  id: string;
  path: string;
  name: string;
  dependencies: string[];
}

/**
 * Updates the agentsConfig.ts file with the latest agents.
 * @param configDir - Path to the config directory.
 * @param agentsConfig - Array of agent configurations.
 */
export const updateAgentsConfig = (configDir: string, agentsConfig: AgentConfig[]) => {
  const agentsConfigPath = path.join(configDir, 'agentsConfig.ts');
  const configContent = `// config/agentsConfig.ts

module.exports = ${JSON.stringify(agentsConfig, null, 2)};
`;
  fs.writeFileSync(agentsConfigPath, configContent, 'utf8');
  console.log('Updated agentsConfig.ts');
};

/**
 * Loads the existing agentsConfig.ts file.
 * @param configDir - Path to the config directory.
 * @returns An array of agent configurations.
 */
export const loadAgentsConfig = (configDir: string): AgentConfig[] => {
  const agentsConfigPath = path.join(configDir, 'agentsConfig.ts');
  let agentsConfig: AgentConfig[] = [];

  if (fs.existsSync(agentsConfigPath)) {
    agentsConfig = requireUncached(agentsConfigPath);
  }

  return agentsConfig;
};

/**
 * Function to safely require modules without cache.
 * @param modulePath - Path to the module.
 * @returns The required module.
 */
const requireUncached = (modulePath: string) => {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
};

/**
 * Handles the entire agent generation process based on a single user input.
 * @param userPrompt - The description of agents to set up provided by the user.
 * @param userObjective - The user's objective derived from the prompt.
 * @param configDir - Path to the config directory.
 * @param agentsDir - Path to the agents directory.
 * @returns An object containing agents created, their details, and an overview of the process.
 */
export const handleAgentGeneration = async (
  userPrompt: string,
  userObjective: string,
  configDir: string,
  agentsDir: string
) => {
  const files = fs.readdirSync(agentsDir);
  if (files.length > 0) {
    throw new Error(
      `The agents directory should be empty. The agents directory (${agentsDir}) contains files: ${files.join(
        ', '
      )}`
    );
  }

  try {
    // Load existing agentsConfig.ts
    let agentsConfig = loadAgentsConfig(configDir);

    // Step 1: Generate agent plan based on user prompt and objective
    const agents = await getAgentPlan(userPrompt, userObjective);
    console.log({ agents });

    if (!agents || agents.length === 0) {
      throw new Error('No agents were extracted from the user input.');
    }

    console.log(`Extracted ${agents.length} agents.`);

    // Step 2: Generate primary agents based on each agent prompt
    const primaryAgentDetails: any[] = []; // Define appropriate type
    const agentsCreated: any[] = []; // Define appropriate type
    const overarchingGoal = JSON.stringify(
      { goal: userPrompt, brokenDownGoal: userObjective },
      null,
      2
    );

    for (const agent of agents) {
      console.log({ agentbeingprocessed: JSON.stringify(agent, null, 2) });
      const extractConfigTemplate = `
You are an **expert system designer** tasked with configuring **autonomous agent classes** based on the provided **agent details** and the **overarching user goal**. Your objective is to **apply first principles thinking** to meticulously design each agent so that it can fully perform its specific part of the overarching goal without any vagueness.

---

## **Instructions**

### **1. Deeply Understand the Overarching Goal**

- **Carefully analyze** the **Overarching User Goal** and **Agent Details** provided.
- **Identify the fundamental components** and **core objectives** that need to be addressed.
- **Determine the specific subtask** that this agent is responsible for within the overarching goal.

### **2. Apply First Principles Thinking**

- **Break down complex problems** into their most basic, fundamental elements.
- **Question assumptions** and focus on the underlying principles relevant to the agent's task.
- **Develop innovative solutions** by building up from these basic principles.

### **3. Define the Agent's Role and Responsibilities**

- **Agent's Purpose**:
  - Provide a **clear and concise description** of the agent's specific role.
  - **Explain how** this role **contributes to the overarching goal**.
- **Operational Scope**:
  - **Detail the boundaries** of the agent's functionality.
  - **Specify what the agent should and should not do**.
  - **Emphasize that the agent processes new user prompts** that align with the overarching goal.
- **Inter-Agent Collaboration**:
  - **Define how the agent interacts** with other agents.
  - **Specify dependencies** and **data sharing mechanisms**.
  - **Ensure synchronization** with other agents to avoid redundancy.

### **4. Develop Comprehensive Instructions**

- **Instructions Field**:
  - **Write exhaustive and detailed instructions** that leave no room for ambiguity.
  - **Include guidelines** on:
    - **Handling inputs**: Describe how the agent should process new user prompts.
    - **Processing logic**: Outline the step-by-step reasoning and algorithms the agent should employ.
    - **Producing outputs**: Define the expected output and its format.
    - **Error handling**: Explain how the agent should handle exceptions or unexpected inputs.
  - **Use clear and precise language** to ensure the agent fully understands its tasks.

### **5. Specify Tools and Resources**

- **Tools**:
  - **List any tools or resources** the agent requires.
  - **Justify the necessity** of each tool in relation to the agent's tasks.
- **Tool Variables**:
  - **Define any variables or configurations** needed for the tools.
  - **Provide default values** or guidelines for setting these variables.

### **6. Define Expected Output and Format**

- **Expected Output**:
  - **Describe in detail** what the agent is expected to produce.
  - **Ensure alignment** with the overarching goal and the agent's specific role.
- **Output Format**:
  - **Specify the exact JSON structure** the agent should use when outputting results.
  - **Include data types**, **field descriptions**, and any **necessary constraints**.

### **7. Formatting and Submission Guidelines**

- **Response Format**:
  - Your response should **only** be a **JSON object** adhering to the structure specified below.
  - **Do not include any additional text**, comments, or explanations outside the JSON structure.
- **Completeness**:
  - **Ensure all fields** in the JSON structure are **thoroughly filled out**.
  - **Double-check** for **accuracy** and **consistency**.
- **Avoid Unrelated Agents**:
  - **Do not create agents** that handle unrelated tasks (such as **error handling** or **feedback loops**) unless these are **directly related to the user-defined goal**.

---

## **Agent Details**

${JSON.stringify(agent, null, 2)}

## **Overarching User Goal**

"${userPrompt}"

---

## **Output Format**

{
  "className": "",          // A concise, PascalCase name for the agent class.
  "id": "",                 // A unique, kebab-case identifier for the agent.
  "name": "",               // A human-readable name for the agent.
  "instructions": "",       // Exhaustive and detailed instructions as per above.
  "primaryAgents": [],      // List of primary agent IDs this agent coordinates with.
  "expectedOutput": "",     // Detailed description of the agent's expected output.
  "outputFormat": {},       // Exact JSON structure of the agent's output.
  "dependencies": [],       // List of agent IDs this agent depends on.
  "tools": [],              // List of tools required by the agent.
  "toolVariables": {}       // Variables or configurations needed for the tools.
}
`;

      // Send the prompt to ChatGPT to extract configuration variables
      const configResponse = await sendMessageToChatGPT(
        { messages: [{ content: extractConfigTemplate, role: 'user' }] },
        'gpt-4o-mini'
      );

      const configText = cleanOpenAIResponse(configResponse.trim());
      console.log({ configText });

      // Parse the JSON response
      let configVariables;
      try {
        configVariables = JSON.parse(configText);
      } catch (parseError: any) {
        console.error(
          'Failed to parse agent configuration JSON:',
          parseError.message
        );
        console.error('Response received:', configText);
        continue; // Skip this agent and proceed with others
      }

      // Validate the presence of required fields
      const requiredFields = [
        'className',
        'id',
        'name',
        'instructions',
        'primaryAgents',
        'expectedOutput',
        'outputFormat',
        'dependencies',
        'tools',
        'toolVariables',
      ];

      const missingFields = requiredFields.filter(
        (field) => !(field in configVariables)
      );

      if (missingFields.length > 0) {
        console.error(
          `Missing fields in configuration for agent "${JSON.stringify(
            agent
          )}": ${missingFields.join(', ')}`
        );
        continue; // Skip this agent and proceed with others
      }

      let {
        className,
        id,
        name,
        instructions,
        primaryAgents,
        expectedOutput,
        outputFormat,
        dependencies,
        tools,
        toolVariables,
      } = configVariables;

      instructions += `

---
## Processing New User Prompts

- When a new user prompt is received, process it according to your specific role.
- Ensure your output contributes towards achieving the overarching goal: "${overarchingGoal}".

## Guidelines

- **Focus**: Stay within your defined subtask and avoid overlapping with other agents.
- **Collaboration**: Share necessary data with other agents as defined in your dependencies.
- **Output**: Provide clear, structured outputs that can be used by the SynthesisAgent.
`;

      // Update configVariables with the modified instructions
      configVariables.instructions = instructions;

      // Collect primary agent details for the orchestrator
      primaryAgentDetails.push({
        id,
        name,
        className,
        instructions,
        primaryAgents,
        expectedOutput,
        outputFormat,
        dependencies,
        tools,
        toolVariables,
      });

      // Prepare the configuration object for primary agent generation
      const primaryAgentConfig = {
        className,
        id,
        name,
        instructions: escapeUnescapedBackticks(instructions),
        primaryAgents,
        expectedOutput,
        outputFormat,
        dependencies,
        tools,
        toolVariables,
        overarchingGoal,
      };

      // Generate the Primary Agent class code
      const primaryAgentCode = generatePrimaryAgent(primaryAgentConfig);

      // Define the file path
      const primaryAgentFilePath = path.join(agentsDir, `${className}.ts`);

      // Write the primary agent code to the file
      fs.writeFileSync(primaryAgentFilePath, primaryAgentCode, 'utf8');

      console.log(`Successfully generated Primary Agent: ${className}`);

      // Append to agentsConfig.ts if not already present
      if (!agentsConfig.some((agent) => agent.id === id)) {
        agentsConfig.push({
          name: className,
          path: `./agents/${className}.js`, // will run after compiled to js
          id: id,
          dependencies: dependencies,
        });
      }

      // Collect agent details for return
      agentsCreated.push({
        id,
        name,
        className,
        instructions,
        expectedOutput,
        outputFormat,
        dependencies,
      });
    }

    // Step 3: Generate the Synthesis Agent
    console.log('Generating Synthesis Agent...');
    // Collect expected outputs and output formats from primary agents
    const agentsExpectedOutputs = primaryAgentDetails.map((agent) => ({
      id: agent.id,
      name: agent.name,
      expectedOutput: agent.expectedOutput,
      outputFormat: agent.outputFormat,
    }));

    // Prepare the prompt for the LLM
    const outputFormatPrompt = `
You are an expert AI assistant. Based on the expected outputs and output formats of the following agents, as well as the user's overall objective, define the optimal output format for a Synthesis Agent that will combine these outputs into a final result.

### User Objective:
"${userObjective}"

### Agents' Expected Outputs and Output Formats:
${JSON.stringify(agentsExpectedOutputs, null, 2)}

### Instructions:
- Analyze the expected outputs and output formats of all agents.
- Determine the most efficient and appropriate output format for the Synthesis Agent.
- The output format should be a JSON schema that includes all necessary fields to represent the synthesized result.
- Ensure the format is clear, unambiguous, and optimized for the user's needs.
- Do not include any extraneous information or explanations.

### Output:
Provide only the JSON schema representing the optimal output format for the Synthesis Agent.
`;

    // Send the prompt to the LLM
    const outputFormatResponse = await sendMessageToChatGPT(
      { messages: [{ content: outputFormatPrompt, role: 'user' }] },
      'gpt-4o-mini'
    );

    // Parse the response to get the output format
    let synthesisAgentOutputFormat;
    try {
      synthesisAgentOutputFormat = JSON.parse(
        cleanOpenAIResponse(outputFormatResponse.trim())
      );
    } catch (error) {
      console.error(
        "Failed to parse the Synthesis Agent's output format:",
        error
      );
      throw error;
    }

    // Log the generated output format
    console.log(
      'Generated Synthesis Agent Output Format:',
      synthesisAgentOutputFormat
    );

    const synthesisAgentInstructions = `
You are the SynthesisAgent. Your primary responsibility is to synthesize the outputs from all other agents to produce the most efficient, appropriate, and valuable output possible. Use the predefined output format specified below.

### Output Format:
${JSON.stringify(synthesisAgentOutputFormat, null, 2)}

### Instructions:
- Carefully review the outputs from all agents.
- Integrate the information to produce a final result.
- Ensure the output strictly adheres to the specified output format.
- Do not include any additional text or explanations outside the JSON format.
`;

    const synthesisAgentConfig = {
      className: 'SynthesisAgent',
      id: 'synthesis-agent',
      name: 'Synthesis Agent',
      instructions: escapeUnescapedBackticks(synthesisAgentInstructions),
      primaryAgents: primaryAgentDetails.map((agent) => agent.id),
      expectedOutput:
        'An intelligently synthesized result adhering to the specified output format.',
      outputFormat: synthesisAgentOutputFormat,
      dependencies: primaryAgentDetails.map((agent) => agent.id),
      tools: [],
      toolVariables: {},
      overarchingGoal,
    };

    // Generate the Synthesis Agent class code
    const synthesisAgentCode = generatePrimaryAgent(synthesisAgentConfig);

    // Define the file path
    const synthesisAgentFilePath = path.join(agentsDir, `SynthesisAgent.ts`);

    // Write the Synthesis Agent code to the file
    fs.writeFileSync(synthesisAgentFilePath, synthesisAgentCode, 'utf8');

    console.log(`Successfully generated Synthesis Agent: SynthesisAgent`);

    // Append SynthesisAgent to agentsConfig.ts if not already present
    if (!agentsConfig.some((agent) => agent.id === synthesisAgentConfig.id)) {
      agentsConfig.push({
        name: synthesisAgentConfig.className,
        path: `./agents/${synthesisAgentConfig.className}.js`,
        id: synthesisAgentConfig.id,
        dependencies: synthesisAgentConfig.dependencies,
      });
    }

    // Collect Synthesis Agent details for return
    agentsCreated.push({
      id: synthesisAgentConfig.id,
      name: synthesisAgentConfig.name,
      className: synthesisAgentConfig.className,
      instructions: synthesisAgentConfig.instructions,
      expectedOutput: synthesisAgentConfig.expectedOutput,
      outputFormat: synthesisAgentConfig.outputFormat,
      dependencies: synthesisAgentConfig.dependencies,
    });

    // Step 5: Generate the Orchestrator Agent
    console.log('Generating Orchestrator Agent...');
    const orchestratorClassName = 'OrchestratorAgent';
    const orchestratorId = 'orchestrator-agent';
    const orchestratorName = 'Orchestrator Agent';
    const orchestratorInstructions =
      'This orchestrator coordinates all primary agents, including the Synthesis Agent, and synthesizes their outputs.';

    const orchestratorConfig = {
      className: orchestratorClassName,
      id: orchestratorId,
      name: orchestratorName,
      instructions: escapeUnescapedBackticks(orchestratorInstructions),
      primaryAgentIds: primaryAgentDetails
        .map((agent) => agent.id)
        .concat(synthesisAgentConfig.id),
      agentsConfig: agentsConfig, // Pass the updated agentsConfig
      dependencies: synthesisAgentConfig.dependencies
    };

    // Generate the Orchestrator Agent class code
    const orchestratorAgentCode = generateOrchestratorAgent(orchestratorConfig);

    // Define the file path
    const orchestratorAgentFilePath = path.join(
      agentsDir,
      `${orchestratorClassName}.ts`
    );

    // Write the Orchestrator Agent code to the file
    fs.writeFileSync(orchestratorAgentFilePath, orchestratorAgentCode, 'utf8');

    console.log(
      `Successfully generated Orchestrator Agent: ${orchestratorClassName}`
    );

    // Append orchestrator to agentsConfig.ts if not already present
    if (!agentsConfig.some((agent) => agent.id === orchestratorId)) {
      agentsConfig.push({
        name: orchestratorClassName,
        path: `./agents/${orchestratorClassName}.js`,
        id: orchestratorId,
        dependencies: orchestratorConfig.primaryAgentIds,
      });
    }

    // Collect orchestrator agent details for return
    agentsCreated.push({
      id: orchestratorId,
      name: orchestratorName,
      className: orchestratorClassName,
      instructions: orchestratorConfig.instructions,
      expectedOutput: 'Final synthesized output based on primary agents\' data.',
      outputFormat: {}, // Define as needed
      dependencies: orchestratorConfig.dependencies,
    });

    // Step 5: Update the agentsConfig.ts file
    updateAgentsConfig(configDir, agentsConfig);

    console.log('All agents have been generated successfully.');

    console.log(' Generating Overview.md file...');

    // Step 6: Return the agents created and overview
    const overview = `
Agent Generation Process Overview:
1. Generated a unique file name for the Lambda function ZIP.
2. Split the user prompt into individual agent prompts.
3. Generated primary agents based on the prompts and collected their details.
4. Created a Synthesis Agent to synthesize outputs from primary agents.
5. Created an Orchestrator Agent to manage and coordinate all agents.
6. Updated the agentsConfig.ts with all agents' configurations.
    `.trim();

// Step 7: Generate Overview.md file
    const overviewPrompt = `
Based on the agents and their expected outputs of the following agents, as well as the user's overall objective, please create an exhaustive and comprehensive Overview.md file for how this system will work. The Overview should include a breakdown of the user's objective, detailed description of the process, the role of each agent, and how they interact to achieve the user's objective.

### User Objective:
"${userObjective}"

### Agents
${JSON.stringify(agents, null, 2)}

### Agents' Expected Outputs and Output Formats:
${JSON.stringify(agentsExpectedOutputs, null, 2)}

### Output:
Provide only the markdown text for the Overview.md file. nothing else, no commentary, just the markdown text.
`;

    // Send the prompt to the LLM
    const overviewResponse = await sendMessageToChatGPT(
      { messages: [{ content: overviewPrompt, role: 'user' }] },
      'o1-mini'
    );
    const cleanedOverviewResponse = cleanOpenAIResponse(overviewResponse.trim(), true)

    // Define the file path
    const overviewFilePath = path.join(
      agentsDir,
      '..',
      `Overview.md`
    );

    // Write the Orchestrator Agent code to the file
    fs.writeFileSync(overviewFilePath, cleanedOverviewResponse, 'utf8');

    return {
      agentsCreated, // Array of agents with their details
      overview, // String summarizing the process
    };
  } catch (error: any) {
    console.error('Error during agent generation:', error.message);
    throw error; // Rethrow to ensure the caller is aware of the failure
  }
};

/**
 * Obtains the user objective based on the user prompt.
 * @param userPrompt - The user prompt.
 * @returns The user objective as a string.
 */
import { OrchestratorAgent as UserObjectiveOrchestratorAgent } from '../user-agent-objective-agents/OrchestratorAgent';

export const getUserObjective = async (userPrompt: string): Promise<string> => {
  // Initialize the orchestrator
  const orchestrator = new UserObjectiveOrchestratorAgent();

  // Define a sample prompt to simulate user input
  const promptObj = {
    id: 'user-objective-1',
    content: userPrompt,
    metadata: {}, // Add any additional metadata as needed
  };

  // Run the orchestrator agent
  try {
    const userObjective = await orchestrator.processPrompt(promptObj, {});

    return userObjective.content;
  } catch (error) {
    console.error('Error during orchestrator execution:', error);
    throw error;
  }
};

/**
 * Obtains the agent plan based on the user prompt and objective.
 * @param userPrompt - The user prompt.
 * @param userObjective - The user objective.
 * @returns The agent plan.
 */
import { OrchestratorAgent as AgentPlannerOrchestratorAgent } from '../agent-planner-agents/OrchestratorAgent';

export const getAgentPlan = async (
  userPrompt: string,
  userObjective: string
): Promise<any[]> => {
  // Initialize the orchestrator
  const orchestrator = new AgentPlannerOrchestratorAgent();

  // Define a sample prompt to simulate user input
  const promptObj = {
    id: 'agent-planner-1',
    content: `
user prompt: ${userPrompt}
user objective: ${JSON.stringify(userObjective)}
`,
    metadata: {}, // Add any additional metadata as needed
  };

  // Run the orchestrator agent
  try {
    const agentPlanResponse = await orchestrator.processPrompt(promptObj, {
      userObjective,
    });
    const agentPlanContent = agentPlanResponse.metadata;
    console.log('agentPlanContent:', agentPlanContent);
    // Assuming agentPlanContent is an array of agents
    return agentPlanContent;
  } catch (error) {
    console.error('Error during agent planner orchestrator execution:', error);
    throw error;
  }
};
