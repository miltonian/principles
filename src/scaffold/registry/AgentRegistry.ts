// registry/AgentRegistry.ts

import { Agent } from '../interfaces/Agent';

class AgentRegistry {
  private agents: Map<string, Agent> = new Map();

  /**
   * Register an agent by its name
   * @param name - The identifier for the agent
   * @param agent - The agent instance
   */
  public registerAgent(name: string, agent: Agent) {
    this.agents.set(name, agent);
  }

  /**
   * Get an agent by its identifier
   */
  public getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all functions available to an agent
   */
  public getFunctions(agentName: string): CallableFunction[] {
    const agent = this.getAgent(agentName);
    return agent?.functions || [];
  }
}

// Singleton logic directly in the same file
const registryInstance = new AgentRegistry();

// Export the singleton instance instead of exporting the class directly
export default registryInstance;
