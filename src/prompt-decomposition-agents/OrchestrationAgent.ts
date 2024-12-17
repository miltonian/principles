// src/orchestrator/OrchestratorAgent.ts

import { IntentExtractionAgent } from "./IntentExtractionAgent";
import { FundamentalTruthsAgent } from "./FundamentalTruthsAgent";
import { DecompositionAgent } from "./DecompositionAgent";
import { RefinementDecisionAgent } from "./RefinementDecisionAgent";
import { IntegrationAgent } from "./IntegrationAgent";
import { FinalIntegrationOutput } from "./types";

export class OrchestratorAgent {
  private intentAgent = new IntentExtractionAgent();
  private truthsAgent = new FundamentalTruthsAgent();
  private decompositionAgent = new DecompositionAgent();
  private refinementDecisionAgent = new RefinementDecisionAgent();
  private integrationAgent = new IntegrationAgent();

  private maxIterations = 5; // Increased to handle more complexity

  async run(userPrompt: string): Promise<FinalIntegrationOutput> {
    // Initial extraction
    const intentResult = await this.intentAgent.processPrompt(userPrompt);
    if (intentResult.status === "error") return { status: "error", errorMessage: intentResult.errorMessage };

    let truthsResult = await this.truthsAgent.deriveTruths(intentResult.intent!);
    if (truthsResult.status === "error") return { status: "error", errorMessage: truthsResult.errorMessage };

    let currentSubtasks: string[] = [];
    let iterationCount = 0;
    let finalize = false;

    while (!finalize && iterationCount < this.maxIterations) {
      iterationCount++;

      // Decompose with current truths
      const decompositionResult = await this.decompositionAgent.decompose(intentResult.intent!, truthsResult.truths!);
      if (decompositionResult.status === "error") return { status: "error", errorMessage: decompositionResult.errorMessage };
      currentSubtasks = decompositionResult.subtasks!;

      // Decide next step
      const decisionResult = await this.refinementDecisionAgent.decide(intentResult.intent!, truthsResult.truths!, currentSubtasks);
      if (decisionResult.status === "error") return { status: "error", errorMessage: decisionResult.errorMessage };

      if (decisionResult.decision === "finalize") {
        finalize = true;
      } else if (decisionResult.decision === "refine_subtasks") {
        // Just loop again, next iteration will re-decompose with the same truths
        // Possibly we could try a different approach if needed.
      } else if (decisionResult.decision === "refine_truths") {
        // Re-derive truths
        truthsResult = await this.truthsAgent.deriveTruths(intentResult.intent!);
        if (truthsResult.status === "error") return { status: "error", errorMessage: truthsResult.errorMessage };
        // After refining truths, we will proceed to next iteration which will re-decompose and re-decide.
      }
    }

    return this.integrationAgent.integrate(intentResult.intent!, intentResult.parameters!, truthsResult.truths!, currentSubtasks);
  }
}
