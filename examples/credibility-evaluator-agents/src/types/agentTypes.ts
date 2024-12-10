// src/types/agentTypes.ts

export interface AgentCreated {
    id: string;
    name: string;
    className: string;
    instructions: string;
    expectedOutput: string;
    outputFormat: any;
    dependencies: string[];
  }
  