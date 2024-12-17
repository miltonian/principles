// src/types.ts

export interface IntentOutput {
    status: "success" | "error";
    intent?: string;
    parameters?: Record<string, string>;
    errorMessage?: string;
  }
  
  export interface FundamentalTruthsOutput {
    status: "success" | "error";
    truths?: string[];
    errorMessage?: string;
  }
  
  export interface DecompositionOutput {
    status: "success" | "error";
    subtasks?: string[];
    errorMessage?: string;
  }
  
  // Now we have three possible decisions
  export type RefinementDecision = "finalize" | "refine_subtasks" | "refine_truths";
  
  export interface RefinementDecisionOutput {
    status: "success" | "error";
    decision?: RefinementDecision;
    notes?: string;
    errorMessage?: string;
  }
  
  export interface AgentDescription {
    id: string;
    name: string;
    role: string;
    purpose: string;
    domainContext: string;
    detailedInstructions: string;
    inputFormat: string;
    outputFormat: string;
    constraints: string;
    resources: string;
    communicationStyle: string;
    exampleInteractions: string[];
    expertiseLevel: string;
    persona: string;
    functionality: string;
    responsibilities: string;
  }
  
  export interface FinalIntegrationOutput {
    status: "success" | "error";
    finalBreakdown?: {
      intent: string;
      parameters: Record<string, string>;
      fundamentalTruths: string[];
      subtasks: string[];
      agents: AgentDescription[];
    };
    errorMessage?: string;
  }
  