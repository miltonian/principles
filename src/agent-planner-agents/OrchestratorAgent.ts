import { Agent } from "../scaffold";
import AgentRegistry from "../scaffold/registry/AgentRegistry";
import {
  initializeOpenAIClient,
  sendMessageToChatGPT,
} from '../llms/openaiClient'
import {cleanOpenAIResponse} from '../utils/responseUtils'

const agentsConfig = require("../agent-planner-config/agentsConfig.js") as {id: string; path: string; name: string; dependencies: string[]}[]

process.env.OPEN_AI_TOKEN && initializeOpenAIClient(process.env.OPEN_AI_TOKEN);

/**
 * Orchestrator Agent
 *
 * This orchestrator coordinates all primary agents and synthesizes their outputs.
 */
export class OrchestratorAgent implements Agent {
    id: string
    name: string
    instructions: string
    primaryAgentIds: string[]

  constructor() {
    this.id = "orchestrator-agent";
    this.name = "Orchestrator Agent";
    this.instructions =
      "This orchestrator coordinates all primary agents and synthesizes their outputs.";
    this.primaryAgentIds = [
      "problem-analysis-agent",
      "task-decomposition-agent",
      "agent-design-agent",
      "communication-integration-agent",
      // "validation-optimization-agent",
    ];
    
    // Register each primary agent based on agentsConfig
    this.primaryAgentIds.forEach((agentId) => {
      // Find the agent configuration by ID
      const agentConfig = agentsConfig.find((agent) => agent.id === agentId);

      if (agentConfig) {
        try {
          // Dynamically import the agent class using its path
          const AgentClass = require(`../${agentConfig.path}`);

          // Register the agent with AgentRegistry
          AgentRegistry.registerAgent(agentId, new AgentClass());

          console.log(
            `Registered agent: ${agentConfig.name} with ID: ${agentId}`
          );
        } catch (error) {
          console.error(`Failed to register agent with ID: ${agentId}`, error);
        }
      } else {
        console.warn(`Agent configuration not found for ID: ${agentId}`);
      }
    });
  }

  /**
   * Processes the incoming prompt by coordinating primary agents and synthesizing results.
   *
   * @param {Prompt} prompt - The incoming prompt.
   * @param {Context} context - The context in which the prompt was received.
   * @returns {Promise<Response>} - The final assessment response.
   */
  async processPrompt(prompt: {id: string; content: string}, context?: any) {
    console.log("OrchestratorAgent: Starting comprehensive assessment.");

    console.log({ primaryAgentIds: this.primaryAgentIds });

    // Initialize assessmentResults
    const assessmentResults: {[agentId: string]: any} = {};
    const agentOutputs: {[agentId: string]: any} = {};

    // Resolve execution order based on dependencies
    const executionOrder = this.resolveDependencies(
      this.primaryAgentIds,
      agentsConfig
    );

    if (!executionOrder) {
      throw new Error("Circular dependency detected among agents.");
    }

    console.log("Execution Order:", executionOrder);

    // Execute agents sequentially based on the resolved order
    for (const agentId of executionOrder) {
      console.log(`Invoking agent: ${agentId}`);

      const agent = AgentRegistry.getAgent(agentId);
      if (agent) {
        try {
          // Pass agentOutputs as part of the context
          const agentResponse = await agent.processPrompt(prompt, {
            agentOutputs,
          });

          // Store the agent's output
          assessmentResults[agentId] = agentResponse.metadata;

          // If the agent succeeded, add its output to agentOutputs
          if (agentResponse.metadata?.status === "success") {
            agentOutputs[agentId] = agentResponse.metadata.data;
          }
        } catch (error: any) {
          console.error(`Error processing ${agentId}:`, error);
          assessmentResults[agentId] = {
            agentId: agentId,
            status: "error",
            code: "PROCESSING_FAILED",
            message: error.message,
          };
        }
      } else {
        console.warn(`Agent ${agentId} not found.`);
        assessmentResults[agentId] = {
          agentId: agentId,
          status: "error",
          code: "AGENT_NOT_FOUND",
          message: "Agent not found.",
        };
      }
    }

    // Synthesize the qualitative findings into a final assessment
    const finalAssessment = await this.synthesizeCode(assessmentResults);

    return {
      promptId: prompt.id,
      content: JSON.stringify(finalAssessment, null, 2),
      metadata: finalAssessment,
    };
  }

  /**
   * Resolves the execution order of agents based on their dependencies using Kahn's algorithm.
   *
   * @param {Array<string>} agentIds - Array of agent IDs to execute.
   * @param {Array<Object>} agentsConfig - Array of agent configurations.
   * @returns {Array<string>|null} - Ordered array of agent IDs or null if a circular dependency is detected.
   */
  resolveDependencies(agentIds: string[], agentsConfig: {id: string; dependencies: string[]}[]) {
    const graph: {[agentId: string]: string[]} = {};
    const inDegree: {[agentId: string]: number} = {};

    // Initialize graph and inDegree
    agentIds.forEach((agentId) => {
      graph[agentId] = [];
      inDegree[agentId] = 0;
    });

    // Build the graph
    agentsConfig.forEach((agent) => {
      const currentAgentId = agent.id;
      if (agent.dependencies && agent.dependencies.length > 0) {
        agent.dependencies.forEach((dep) => {
          if (graph[dep]) {
            graph[dep].push(currentAgentId);
            inDegree[currentAgentId]++;
          }
        });
      }
    });

    // Kahn's algorithm for topological sorting
    const queue: string[] = [];
    Object.keys(inDegree).forEach((agentId) => {
      if (inDegree[agentId] === 0) {
        queue.push(agentId);
      }
    });

    const sortedOrder: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if(!current) continue
      sortedOrder.push(current);

      graph[current].forEach((neighbor) => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }

    // If sortedOrder contains all agents, return it. Otherwise, a circular dependency exists.
    if (sortedOrder.length === agentIds.length) {
      return sortedOrder;
    } else {
      return null;
    }
  }

  /**
   * Synthesizes the collected assessment results into a final qualitative evaluation.
   *
   * @param {Object} assessmentResults - The outputs from all primary agents.
   * @returns {Object} - The final assessment.
   */
  async synthesizeCode(assessmentResults: {[agentId: string]: any}) {
    const finalOutput: {[agentId: string]: any} = {};
    const errors: string[] = [];
    let maxArrayLength = 0
    console.log({assessmentResults: JSON.stringify(assessmentResults, null, 2)})
    for (const [agentID, agentOutput] of Object.entries(assessmentResults)) {
      if (!agentOutput || !agentOutput.data) {
        errors.push(`Missing output from agent ${agentID}`);
        continue;
      }
      if (typeof agentOutput.data !== "object") {
        errors.push(`Invalid data format from agent ${agentID}`);
        continue;
      }
      for (const [key, value] of Object.entries(agentOutput.data)) {
        if (!finalOutput[key]) {
          finalOutput[key] = [];
        }
        finalOutput[key].push(value);
      }
      // maxArrayLength = Math.max(maxArrayLength, finalOutput[key].length)
    }
    if (errors.length > 0) {
      finalOutput.errors = errors;
    }
    try {
      const synthesizedResult = [];

      // for (let i = 0; i < maxArrayLength; i++) {
      //   synthesizedResult.push({
      //     component: finalOutput.components?.[i] || null,
      //     agent: finalOutput.agents?.[i] || null,
      //     prompt: finalOutput.prompts?.[i] || null,
      //     error: finalOutput.errors?.[i] || null,
      //   });
      // }
      const synthesizedAgents = await sendMessageToChatGPT(
        {messages: [
          {content: `
            I will provide you with unstructured data containing information about multiple ai agents. Your task is to parse this data and return a JSON object with an "agents" array, where each element is an object representing an individual agent with all relevant details extracted from the input.

**Requirements:**

1. **Output Format:**
    {
      "agents": [
        {
          name: '',
          role: '',
          functionality: '',
          communicationProtocols: [],
          dependencies: []
        },
        // Additional agent objects
      ]
    }

2. **Data Extraction:**
    - For each agent mentioned in the unstructured data, extract all available details
    - Ensure you extract an exhaustive list from each agent given to you as context, don't forget any dependencies mentioned either
    - The data you're given has a set of agents in it already, your job is to analyze that along with the other data given, to pull in all the relevant data that doesnt live in that agents array yet
    - Use all of the context to add to the current agent array

3. **Handling Missing Information:**
    - If certain details are missing for an agent, simply omit those fields from that agent's JSON object.
    - Ensure that the JSON remains valid even if some agents have fewer details.

4. **Consistency and Formatting:**
    - Use clear and consistent key names for each piece of information.
    - Ensure all string values are properly quoted and escaped as necessary.
    - Maintain proper JSON syntax to avoid errors.


**Instructions:**

1. **Parse the Unstructured Data:**
    - Identify and separate information pertaining to each individual agent.
    - Extract all relevant details as outlined in the requirements.
    - Ensure you extract an exhaustive list from each agent given to you as context, don't forget any dependencies mentioned either
    - The data you're given has a set of agents in it already, your job is to analyze that along with the other data given, to pull in all the relevant data that doesnt live in that agents array yet
    - Use all of the context to add to the current agent array

2. **Construct the JSON Object:**
    - Populate the "agents" array with objects containing the extracted details for each agent.
    - Ensure that all available information is included and properly formatted.
    - The data you're given has a set of agents in it already, your job is to analyze that along with the other data given, to pull in all the relevant data that doesnt live in that agents array yet
    - Use all of the context to add to the current agent array
    - In each agent in the array you respond with, you should include data from the context: communication integration, problem analysis, task decomposition, and agent design

3. **Validate the JSON:**
    - Check that the final JSON adheres to the specified structure.
    - Ensure there are no syntax errors and that all data accurately reflects the input.


  Context: ${JSON.stringify(finalOutput, null, 2)}
  `, role: "user"}
        ]},
        'o1-mini'
      )
      const structuredAgents = JSON.parse(cleanOpenAIResponse(synthesizedAgents.trim()))
console.log({finalOutput: JSON.stringify(structuredAgents, null, 2)})

      return structuredAgents.agents;
    } catch {
      return { error: "Synthesis failed due to unexpected error" };
    }
  }
}

export default OrchestratorAgent