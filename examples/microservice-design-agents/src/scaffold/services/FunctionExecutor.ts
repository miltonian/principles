import { FunctionCall, FunctionResult } from '../interfaces/Function';
import AgentRegistry from '../registry/AgentRegistry';
import { Context } from '../interfaces/Context';

export class FunctionExecutor {
  /**
   * Executes a function call and returns the result
   * @param funcCall - The function call details
   * @param agentName - The name of the agent executing the function
   * @param context - Current context
   */
  public async execute(funcCall: FunctionCall, agentName: string, context?: Context): Promise<FunctionResult> {
    const functions = AgentRegistry.getFunctions(agentName);
    const func = functions.find(f => f.name === funcCall.name);

    if (!func) {
      throw new Error(`Function not found: ${funcCall.name}`);
    }

    // Execute the function with the provided arguments
    const result: FunctionResult = await func(...Object.values(funcCall.args));

    return result;
  }
}
