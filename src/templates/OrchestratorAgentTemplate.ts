export function generateOrchestratorAgent(config: {
  className: string;
  id: string;
  name: string;
  instructions: string;
  primaryAgentIds: string[];
  agentsConfig: {
    id: string;
    path: string;
    name: string;
    dependencies: string[];
  }[];
  userObjective: string
}) {
  const { className, id, name, instructions, primaryAgentIds } = config;

  // Format primaryAgentIds for inclusion in the array
  const primaryAgentsFormatted = primaryAgentIds
    .map((agentId) => `      "${agentId}",`)
    .join("\n");

  return `// agents/${className}.ts
import AgentRegistry from "../scaffold/registry/AgentRegistry";
const agentsConfig = require("../config/agentsConfig") as {id: string; path: string; name: string; dependencies: string[]}[]
import { initializeOpenAIClient, sendMessageToChatGPT } from '../llms/openaiClient'
import { cleanOpenAIResponse } from '../utils/responseUtils'
import { Agent, Response } from "../scaffold";
import { Message } from "../types/llmTypes";

process.env.OPEN_AI_TOKEN && initializeOpenAIClient(process.env.OPEN_AI_TOKEN);

/**
 * ${name}
 *
 * ${instructions}
 */
export class ${className} implements Agent {
  id: string 
  name: string 
  instructions: string 
  overarchingGoal: string = ${JSON.stringify(config.userObjective)}
  primaryAgentIds: string[]
  toolVariables: {[name: string]: any} | undefined

  // Keep track of fixes and improvements over multiple attempts for each agent
  fixHistory: {[agentId: string]: Array<{reflection: string; improvedInstructions: string}>} = {};

  constructor() {
    this.id = "${id}";
    this.name = "${name}";
    this.instructions = "${instructions.replace(/"/g, '\\"')}";
    this.primaryAgentIds = [
        ${primaryAgentsFormatted}
    ];

    // Register each primary agent based on agentsConfig
    this.primaryAgentIds.forEach(agentId => {
      // Find the agent configuration by ID
      const agentConfig = agentsConfig.find(agent => agent.id === agentId);
      
      if (agentConfig) {
        try {
          // Dynamically import the agent class using its path
          const AgentClass = require(\`../\${agentConfig.path}\`).default;
          
          // Register the agent with AgentRegistry
          AgentRegistry.registerAgent(agentId, new AgentClass());
          
          console.log(\`Registered agent: \${agentConfig.name} with ID: \${agentId}\`);
        } catch (error: any) {
          console.error(\`Failed to register agent with ID: \${agentId}\`, error);
        }
      } else {
        console.warn(\`Agent configuration not found for ID: \${agentId}\`);
      }
    });
  }

  async processPrompt(prompt: {id: string; content: string}, context?: any) {
    console.log("${className}: Starting comprehensive assessment.");

    const assessmentResults: {[agentId: string]: any} = {};
    const agentOutputs: {[agentId: string]: any} = {};
    const sharedData = {};
    
    const executionOrder = this.resolveDependencies(this.primaryAgentIds, agentsConfig);
    if (!executionOrder) {
      throw new Error("Circular dependency detected among agents.");
    }

    console.log("Execution Order:", executionOrder);
    const executionLevels = this.groupAgentsByLevels(executionOrder, agentsConfig);

    for (const levelAgents of executionLevels) {
      if (!levelAgents) continue;
      console.log(\`Executing level with agents: \${levelAgents.join(", ")}\`);

      await Promise.all(
        levelAgents.map(async (agentId) => {
          if (this.shouldExecuteAgent(agentId, context)) {
            const agent = AgentRegistry.getAgent(agentId);
            const agentConfig = agentsConfig.find((cfg) => cfg.id === agentId);

            const relevantAgentOutputs: { [depId: string]: any } = {};
            if (agentConfig && agentConfig.dependencies) {
              agentConfig.dependencies.forEach((depId) => {
                if (agentOutputs[depId]) {
                  relevantAgentOutputs[depId] = agentOutputs[depId];
                }
              });
            }

            const agentContext = {
              agentOutputs: relevantAgentOutputs,
              sharedData,
            };

            if (agent) {
              try {
                console.log(\`Starting execution of agent \${agentId} at \${new Date().toISOString()}\`);
                const startTime = Date.now();

                const agentResponse = await this.executeAgentWithReflection(agent, prompt, agentContext, agentConfig!, 5);

                const duration = Date.now() - startTime;
                console.log(\`Agent \${agentId} completed in \${duration} ms with status: \${agentResponse?.metadata?.status}\`);

                assessmentResults[agentId] = agentResponse?.metadata;

                if (agentResponse?.metadata?.status === "success") {
                  agentOutputs[agentId] = agentResponse.metadata.data;
                }
              } catch (error: any) {
                console.error(\`Agent \${agentId} failed: \${error.message}\`);
                assessmentResults[agentId] = {
                  agentId: agentId,
                  status: "error",
                  code: "EXECUTION_FAILED",
                  message: error.message,
                };
              }
            } else {
              console.warn(\`Agent \${agentId} not found.\`);
              assessmentResults[agentId] = {
                agentId: agentId,
                status: "error",
                code: "AGENT_NOT_FOUND",
                message: "Agent not found.",
              };
            }
          } else {
            console.log(\`Skipping agent \${agentId} based on conditions.\`);
          }
        })
      );
    }

    const finalAssessment = await this.synthesizeCode(assessmentResults);

    return {
      promptId: prompt.id,
      content: JSON.stringify(finalAssessment, null, 2),
      metadata: finalAssessment,
    };
  }

  async reflectionPrompt(userObjective: string, agentRoleAndInstructions: string, agentOutput: any, fixHistoryForAgent: Array<{reflection: string; improvedInstructions: string}>) {
    const previousFixes = fixHistoryForAgent.map((item, index) => {
      return {
        attempt: index + 1,
        reflection: item.reflection,
        improved_instructions: item.improvedInstructions
      };
    });

    const systemMessage: Message = {
      role: "system",
      content: \`
You are the Orchestration Evaluator, a strict and detail-oriented reviewer. You have the following rules:
- You must respond in strict JSON only.
- No additional commentary or text outside the JSON.
- If the output is insufficient, you must produce extremely detailed, step-by-step instructions that precisely guide the agent on how to fix every identified issue.
- Always reference the fix history to avoid repeating previous failed attempts.
- Use unambiguous language.
- If sufficient, return the exact "sufficient" JSON. If insufficient, return the exact "insufficient" JSON with the required fields.
\`
    };

    const userMessage: Message = {
      role: "user",
      content: \`
      **Overarching User Objective:**
      "\${userObjective}"

      **Agent's Role & Instructions:**
      \${agentRoleAndInstructions}

      **Agent's Latest Output:**
      \${JSON.stringify(agentOutput, null, 2)}

      Evaluate if this agent's output meets the requirements in the agent's role and instructions and aligns with the overarching objective.

      If "sufficient":
      {
        "status": "sufficient",
        "message": "The output meets the requirements in the agent's role and instructions and aligns with the overarching objective. Proceed."
      }

      If "insufficient":
      {
        "status": "insufficient",
        "reflection": "Explain clearly and specifically why it's insufficient.",
        "improved_instructions": "Provide a step-by-step, exhaustive, and explicit guide to fix the problems. Reference past attempts if available and indicate how to avoid previous mistakes. The instructions should leave no ambiguity. Spell out exactly how to modify the content, format, or logic to meet the requirements."
      }
\`
    };

    const resp = await sendMessageToChatGPT({ messages: [systemMessage, userMessage] }, 'gpt-4o');
    const cleaned = cleanOpenAIResponse(resp.trim(), true);
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse reflection response:", cleaned);
      jsonResponse = { status: "insufficient", reflection: "Could not parse JSON", improved_instructions: "Please ensure response is valid JSON." };
    }
    return jsonResponse;
  }

  async executeAgentWithReflection(agent: Agent, prompt: {id: string; content: string}, context: any, agentConfig: {id: string; name: string; dependencies: string[]}, maxAttempts = 5): Promise<Response> {
    let attempts = 0;
    let lastResponse;

    if (!this.fixHistory[agentConfig.id]) {
      this.fixHistory[agentConfig.id] = [];
    }

    let updatedInstructions = "";

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const modifiedContext = {
          ...context,
          variables: { ...context.variables, improvedInstructions: updatedInstructions }
        };

        const agentResponse = await agent.processPrompt(prompt, modifiedContext);
        lastResponse = agentResponse;

        if (agentResponse?.metadata?.status !== "success") {
          break;
        }

        const reflection = await this.reflectionPrompt(this.overarchingGoal, agent.instructions, agentResponse.metadata.data, this.fixHistory[agentConfig.id]);

        if (reflection.status === "sufficient") {
          return agentResponse;
        } else if (reflection.status === "insufficient") {
          this.fixHistory[agentConfig.id].push({
            reflection: reflection.reflection,
            improvedInstructions: reflection.improved_instructions
          });
          updatedInstructions = reflection.improved_instructions || "";
          console.log(\`Reflection: Agent output insufficient, retrying with improved instructions...\`);
        } else {
          break;
        }

      } catch (error: any) {
        console.error(\`Error executing agent with reflection \${agent.id}: \${error.message}\`);
        if (attempts >= maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, attempts * 1000));
      }
    }

    return lastResponse || { promptId: '', content: '', metadata: { status: "error", code: "MAX_ATTEMPTS_EXCEEDED", message: "Failed to get sufficient output within the allowed attempts." }};
  }

  resolveDependencies(agentIds: string[], agentsConfig: {
    id: string;
    path: string;
    name: string;
    dependencies: string[];
  }[]) {
    const graph: {[agentId: string]: string[]} = {};
    const inDegree: {[agentId: string]: number} = {};

    agentIds.forEach(agentId => {
      graph[agentId] = [];
      inDegree[agentId] = 0;
    });

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

    if (sortedOrder.length === agentIds.length) {
      return sortedOrder;
    } else {
      console.error("Circular dependency detected among agents.");
      return null;
    }
  }

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

  shouldExecuteAgent(agentId: string, context?: any) {
    return true; // By default, execute all agents
  }

  async synthesizeCode(assessmentResults: {[agentId: string]: any}) {
    return assessmentResults["synthesis-agent"];
  }
}

export default ${className};
`;
}
