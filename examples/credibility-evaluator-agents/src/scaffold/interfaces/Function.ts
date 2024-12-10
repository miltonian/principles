export interface FunctionCall {
    name: string;
    args: Record<string, any>;
  }
  
  export interface FunctionResult {
    value: string;
    nextAgentId?: string;
    context?: Record<string, any>;
  }
  