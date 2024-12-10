// services/PromptHandler.ts

import { Prompt, Response } from '../interfaces/Types';
import { FunctionCall, FunctionResult } from '../interfaces/Function';
import { v4 as uuidv4 } from 'uuid';
import AgentRegistry from '../registry/AgentRegistry';
import { FunctionExecutor } from './FunctionExecutor';

export class PromptHandler {
  private functionExecutor: FunctionExecutor;

  constructor() {
    this.functionExecutor = new FunctionExecutor();
  }
  
  // Handle the prompt and route it to the correct agent
  public async handlePrompt(promptContent: string, agentName: string, context?: Record<string, any>): Promise<Response> {
    const agent = AgentRegistry.getAgent(agentName);  // Use the singleton instance directly

    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    // Generate a unique ID for the prompt
    const prompt: Prompt = {
      id: uuidv4(),
      content: promptContent,
      metadata: context,
    };

    // Forward the prompt to the agent's processPrompt method
    const response = await agent.processPrompt(prompt, context);

    // Handle function calls if any
    if (response.functionCall) {
      const funcResult = await this.functionExecutor.execute(response.functionCall, agentName, context);
      if (funcResult.nextAgentId) {
        response.nextAgentId = funcResult.nextAgentId;
      }
      if (funcResult.value) {
        response.content += `\nFunction Result: ${funcResult.value}`;
      }
      if (funcResult.context) {
        response.metadata = { ...response.metadata, ...funcResult.context };
      }
    }

    return response;
  }

  // Execute the function and handle the result
  private async executeFunction(funcCall: FunctionCall, agentName: string, context?: Record<string, any>): Promise<FunctionResult> {
    const functions = AgentRegistry.getFunctions(agentName);
    const func = functions.find(f => f.name === funcCall.name);

    if (!func) {
      throw new Error(`Function not found: ${funcCall.name}`);
    }

    // Execute the function
    const result: FunctionResult = await func(...Object.values(funcCall.args));

    return result;
  }
}
