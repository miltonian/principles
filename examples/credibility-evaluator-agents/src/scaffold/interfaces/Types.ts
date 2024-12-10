import { FunctionResult, FunctionCall } from './Function';

export interface Prompt {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface Response {
  promptId: string;
  content: string;
  metadata?: Record<string, any>;
  nextAgentId?: string;
  functionCall?: FunctionCall;
}

export interface FunctionResponse extends FunctionResult {}
