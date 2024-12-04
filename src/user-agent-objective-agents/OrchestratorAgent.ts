// src/user-agent-objective-agents/OrchestratorAgent.ts
const agentsConfigContents = require("../user-agent-objective-config/agentsConfig.js") as {id: string; path: string; name: string; dependencies: string[]}[]
import { Agent } from '../scaffold';
import AgentRegistry from '../scaffold/registry/AgentRegistry';
import { initializeOpenAIClient } from '../llms/openaiClient'


process.env.OPEN_AI_TOKEN && initializeOpenAIClient(process.env.OPEN_AI_TOKEN);

/**
 * Orchestrator Agent
 *
 * This orchestrator coordinates all primary agents, including the Synthesis Agent, and synthesizes their outputs.
 */
export class OrchestratorAgent {
  id: string 
  name: string 
  instructions: string 
  primaryAgentIds: string[]

  
  constructor() {
    this.id = "orchestrator-agent";
    this.name = "Orchestrator Agent";
    this.instructions = "This orchestrator coordinates all primary agents, including the Synthesis Agent, and synthesizes their outputs.";
    this.primaryAgentIds = [
      "prompt-analysis-agent",
      "intent-extraction-agent",
      "decomposition-framework-agent",
      "alignment-verification-agent",
      "breakdown-compilation-agent",
      "output-formatting-agent",
      "verification-agent",
      "integration-agent",
      "synthesis-agent",
    ];

    // Register each primary agent based on agentsConfig
    this.primaryAgentIds.forEach(agentId => {
      // Find the agent configuration by ID
      const agentConfig = agentsConfigContents.find(agent => agent.id === agentId);
      
      if (agentConfig) {
        try {
          // Dynamically import the agent class using its path
          const AgentClass = require(`../${agentConfig.path}`);
          
          // Register the agent with AgentRegistry
          AgentRegistry.registerAgent(agentId, new AgentClass());
          
          console.log(`Registered agent: ${agentConfig.name} with ID: ${agentId}`);
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
   * @param {Object} prompt - The incoming prompt.
   * @param {Object} context - The context in which the prompt was received.
   * @returns {Promise<Object>} - The final assessment response.
   */
  async processPrompt(prompt: {id: string; content: string}, context?: any) {
    console.log("OrchestratorAgent: Starting comprehensive assessment.");

    // Initialize assessmentResults and agentOutputs
    const assessmentResults: {[agentId: string]: any} = {};
    const agentOutputs: {[agentId: string]: any} = {};
    const sharedData = {};

    // Resolve execution order based on dependencies
    const executionOrder = this.resolveDependencies(this.primaryAgentIds, agentsConfigContents);

    if (!executionOrder) {
      throw new Error("Circular dependency detected among agents.");
    }

    console.log("Execution Order:", executionOrder);

    // Group agents by levels for parallel execution
    const executionLevels = this.groupAgentsByLevels(executionOrder, agentsConfigContents);

    // Execute agents level by level
    for (const levelAgents of executionLevels) {
      if(!levelAgents) continue;
      console.log(`Executing level with agents: ${levelAgents.join(", ")}`);

      await Promise.all(
        levelAgents.map(async (agentId) => {
          if (this.shouldExecuteAgent(agentId, context)) {
            const agent = AgentRegistry.getAgent(agentId);
            if (agent) {
              try {
                console.log(`Starting execution of agent ${agentId} at ${new Date().toISOString()}`);
                const startTime = Date.now();

                // Execute agent with retries
                const agentResponse = await this.executeAgentWithRetries(agent, prompt, {
                  agentOutputs,
                  sharedData,
                });

                const duration = Date.now() - startTime;
                console.log(`Agent ${agentId} completed in ${duration} ms with status: ${agentResponse?.metadata?.status}`);

                // Store the agent's output
                assessmentResults[agentId] = agentResponse?.metadata;

                // If the agent succeeded, add its output to agentOutputs
                if (agentResponse?.metadata?.status === "success") {
                  agentOutputs[agentId] = agentResponse.metadata.data;
                }
              } catch (error: any) {
                console.error(`Agent ${agentId} failed: ${error.message}`);
                assessmentResults[agentId] = {
                  agentId: agentId,
                  status: "error",
                  code: "EXECUTION_FAILED",
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
          } else {
            console.log(`Skipping agent ${agentId} based on conditions.`);
          }
        })
      );
    }

    // Synthesize the qualitative findings into a final assessment
    const finalAssessmentResp = await this.synthesizeCode(assessmentResults);
    console.log('final assessment')
    console.log(JSON.stringify(finalAssessmentResp, null, 2))
    const finalAssessment = finalAssessmentResp.data.properties.formattedBreakdown.properties.formattedBreakdown
// console.log('final assessment')
// console.log(JSON.stringify(finalAssessment, null, 2))
// console.log(JSON.stringify(finalAssessment.data.properties.formattedBreakdown.properties.formattedBreakdown, null, 2))
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
  resolveDependencies(agentIds: string[], agentsConfig: {
    id: string;
    path: string;
    name: string;
    dependencies: string[];
}[]) {
  const graph: {[agentId: string]: string[]} = {};
  const inDegree: {[agentId: string]: number} = {};

    // Initialize graph and inDegree
    agentIds.forEach(agentId => {
      graph[agentId] = [];
      inDegree[agentId] = 0;
    });

    // Build the graph
    agentsConfig.forEach(agent => {
      const currentAgentId = agent.id;
      if (agent.dependencies && agent.dependencies.length > 0) {
        agent.dependencies.forEach(dep => {
          if (graph[dep]) {
            graph[dep].push(currentAgentId);
            inDegree[currentAgentId]++;
          }
        });
      }
    });

    // Kahn's algorithm for topological sorting
    const queue: string[] = [];
    Object.keys(inDegree).forEach(agentId => {
      if (inDegree[agentId] === 0) {
        queue.push(agentId);
      }
    });

    const sortedOrder: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if(!current) continue;
      sortedOrder.push(current);

      graph[current].forEach(neighbor => {
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
      console.error("Circular dependency detected among agents.");
      return null;
    }
  }

  /**
   * Groups agents into execution levels based on dependencies.
   *
   * @param {Array<string>} executionOrder - Ordered array of agent IDs.
   * @param {Array<Object>} agentsConfig - Array of agent configurations.
   * @returns {Array<Array<string>>} - Array of agent ID arrays, each representing a level.
   */
  groupAgentsByLevels(executionOrder: string[], agentsConfig: {
    id: string;
    path: string;
    name: string;
    dependencies: string[];
}[]) {
    const levels: string[][] = [];
    const agentLevels: {[agentId: string]: number} = {};
    const agentConfigs = Object.fromEntries(agentsConfig.map(agent => [agent.id, agent]));

    executionOrder.forEach(agentId => {
      const agent = agentConfigs[agentId];
      const dependencies = agent.dependencies || [];
      let level = 0;
      dependencies.forEach(dep => {
        level = Math.max(level, (agentLevels[dep] || 0) + 1);
      });
      agentLevels[agentId] = level;
      if (!levels[level]) {
        levels[level] = [];
      }
      levels[level].push(agentId);
    });

    return levels;
  }

  /**
   * Determines whether an agent should be executed based on runtime conditions.
   *
   * @param {string} agentId - The ID of the agent.
   * @param {Object} context - The execution context.
   * @returns {boolean} - True if the agent should be executed; false otherwise.
   */
  shouldExecuteAgent(agentId: string, context?: any) {
    // Implement your conditional logic here
    return true; // By default, execute all agents
  }

  /**
   * Executes an agent with retry logic.
   *
   * @param {Object} agent - The agent instance.
   * @param {Object} prompt - The prompt to process.
   * @param {Object} context - The execution context.
   * @param {number} maxRetries - Maximum number of retries.
   * @returns {Promise<Object>} - The agent's response.
   */
  async executeAgentWithRetries(agent: Agent, prompt: {id: string; content: string}, context?: any, maxRetries = 3) {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        const agentResponse = await agent.processPrompt(prompt, context);
        return agentResponse;
      } catch (error: any) {
        attempts++;
        console.error(`Error executing agent ${agent.id}: ${error.message}`);
        if (attempts >= maxRetries) {
          throw error;
        }
        // Implement exponential backoff or fixed delay
        await new Promise(resolve => setTimeout(resolve, attempts * 1000));
      }
    }
  }

  /**
   * Synthesizes the collected assessment results into a final qualitative evaluation.
   *
   * @param {Object} assessmentResults - The outputs from all primary agents.
   * @returns {Object} - The final assessment.
   */
  async synthesizeCode(assessmentResults: {[agentId: string]: any}) {
    return assessmentResults["synthesis-agent"];
  }
}


export default OrchestratorAgent