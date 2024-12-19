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

import { OrchestratorAgent as PromptDecompositionOrchestratorAgent } from "../prompt-decomposition-agents/OrchestrationAgent"
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
    // const agents = await getAgentPlan(userPrompt, userObjective);
    const orchestrator = new PromptDecompositionOrchestratorAgent()
    const agentResponse = await orchestrator.run(userObjective)
    console.log({agentResponse: JSON.stringify(agentResponse, null, 2)});
    
    const agents = agentResponse.finalBreakdown?.agents ||[]
    

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
You are an **expert agent architect**, tasked with defining a single **autonomous agent class** that precisely fulfills the role described in the **Agent Details** while contributing to the **Overarching User Goal**. Your objective is to use **first principles thinking** to produce an unambiguous, fully realized specification of this agent's purpose, instructions, and expected outputs.

**Key Requirements:**

1. **Single-Purpose Focus:**  
   The agent must strictly focus on its assigned role as described in the **Agent Details**. It should **not** attempt to handle tasks outside this domain.

2. **Restricted Capabilities:**  
   The agent's **only capability** is to process prompts through a Large Language Model (LLM).

3. **Data Sources:**  
   The agent can use:
   - **User-Provided Data:** Any data given in the user's prompt.
   - **Outputs from Previously Executed Agents:** Results already produced by agents that have run before this one.
   - **LLM Training Data:** Relevant knowledge contained within the LLM's internal training data.  
   
   The agent cannot access external data sources beyond these.

4. **Sequential Data Use:**  
   The agent may leverage outputs from other agents only if those agents have already executed. The agent must not assume access to future or unexecuted agents' outputs.

5. **First Principles Approach:**  
   Decompose the agent's responsibilities into their most fundamental elements. Align the agent's instructions closely with its underlying purpose and the overarching user goal.

6. **Clarity and Completeness:**  
   Define the agent's instructions, expected outputs, and operational boundaries with absolute clarity. Each guideline should be specific and unambiguous.

7. **No Extraneous Roles:**  
   Do not introduce tasks unrelated to the agent's defined purpose, such as separate error handling or feedback loops, unless explicitly required.

8. **Strict JSON Output Only:**  
   The final response must strictly follow the JSON structure below. No additional commentary, explanations, or text outside the JSON object is allowed.

---

## **Instructions for Agent Definition**

### 1. Understand the Agent's Core Purpose

- Analyze the **Overarching User Goal** and the **Agent Details**.
- Identify the singular, fundamental role the agent must perform.
- Ensure the agent's role is minimal, self-contained, and not overlapping with other agents.

### 2. Refine with First Principles Thinking

- Reduce the agent's responsibilities to their most essential functions.
- Remove unnecessary complexity and assumptions.
- Break down the tasks until they cannot be reduced further without losing meaning.

### 3. Define the Agent's Role and Limits

- Clearly describe the agent's exact function and how it advances the overarching goal.
- Specify what the agent will and will not do.
- Emphasize that the agent only processes prompts via the LLM, using user data, previously produced agent outputs, and knowledge from the LLM's training data as needed.

### 4. Draft Comprehensive Instructions

- Provide step-by-step instructions detailing how the agent processes incoming prompts.
- Include how the agent integrates user data, prior agent outputs, and relevant LLM training data.
- Define reasoning steps, expected responses, and how to structure outputs.
- Avoid any instructions unrelated to the agent's purpose.

### 5. Specify Expected Output and Format

- Clearly define what the agent should output when it receives a new prompt.
- Ensure the output aligns with the overarching goal.
- Include an explicit JSON schema or structure that the agent will use for its results.

### 6. Integration with Other Agents

- If applicable, outline how this agent uses outputs from previously run agents.
- The agent should not assume capabilities or data beyond those sources allowed.

### 7. Complete the Required JSON Fields

- Fill out every field in the provided structure accurately.
- Double-check for consistency and completeness.

---

## **Agent Details**

${JSON.stringify(agent, null, 2)}

## **Overarching User Goal**
"${userObjective}"

---

## **Output Format**

{
  "className": "",          // A concise, PascalCase name for the agent class.
  "id": "",                 // A unique, kebab-case identifier for the agent with an identifier that is relevant to the agent's role.
  "name": "",               // A human-readable name for the agent.
  "instructions": "",       // Exhaustive and detailed instructions as per above.
  "primaryAgents": [],      // List of primary agent IDs this agent coordinates with.
  "expectedOutput": "",     // Detailed description of the agent's expected output.
  "outputFormat": {},       // Exact JSON structure of the agent's output.
  "dependencies": [],       // List of agent IDs this agent depends on. (e.g. ["agent-1", "agent-2"])
  "tools": [],              // List of tools required by the agent.
  "toolVariables": {}       // Variables or configurations needed for the tools.
}
`;

      // Send the prompt to ChatGPT to extract configuration variables
      const configResponse = await sendMessageToChatGPT(
        { messages: [{ content: extractConfigTemplate, role: 'user' }] },
        'o1-mini'
      );

      const configText = cleanOpenAIResponse(configResponse.trim(), true);
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
        instructions: escapeUnescapedBackticks(instructions).replace(/\\\\`/g, '\\`'),
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

## Processing New User Prompts

- When a new user prompt is received, process it according to your specific role.
- Ensure your output contributes towards achieving the overarching goal: "${overarchingGoal}".

## Guidelines

- **Focus**: Stay within your defined subtask and avoid overlapping with other agents.
- **Collaboration**: Share necessary data with other agents as defined in your dependencies.
- **Output**: Provide clear, structured outputs that can be used by the SynthesisAgent.
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
      dependencies: synthesisAgentConfig.dependencies,
      userObjective
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
