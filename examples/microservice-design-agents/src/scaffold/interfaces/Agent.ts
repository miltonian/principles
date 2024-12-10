// interfaces/Agent.ts

import { Prompt, Response } from './Types';
import { Context } from './Context';
import { FunctionCall, FunctionResult } from './Function';

export interface Agent {
  id: string;
  name: string;
  instructions: string;
  functions?: CallableFunction[]; // Optional list of functions the agent can call
  processPrompt(prompt: Prompt, context?: Context): Promise<Response>;
}
