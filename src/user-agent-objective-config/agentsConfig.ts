// config/agentsConfig.js

module.exports = [
  {
    "name": "PromptAnalysisAgent",
    "path": "./user-agent-objective-agents/PromptAnalysisAgent.js",
    "id": "prompt-analysis-agent",
    "dependencies": []
  },
  {
    "name": "IntentExtractionAgent",
    "path": "./user-agent-objective-agents/IntentExtractionAgent.js",
    "id": "intent-extraction-agent",
    "dependencies": []
  },
  {
    "name": "DecompositionFrameworkAgent",
    "path": "./user-agent-objective-agents/DecompositionFrameworkAgent.js",
    "id": "decomposition-framework-agent",
    "dependencies": []
  },
  {
    "name": "AlignmentVerificationAgent",
    "path": "./user-agent-objective-agents/AlignmentVerificationAgent.js",
    "id": "alignment-verification-agent",
    "dependencies": [
      "component-breakdown-agent"
    ]
  },
  {
    "name": "BreakdownCompilationAgent",
    "path": "./user-agent-objective-agents/BreakdownCompilationAgent.js",
    "id": "breakdown-compilation-agent",
    "dependencies": [
      "component-identifier-agent",
      // "component-validation-agent"
    ]
  },
  {
    "name": "OutputFormattingAgent",
    "path": "./user-agent-objective-agents/OutputFormattingAgent.js",
    "id": "output-formatting-agent",
    "dependencies": [
      "breakdown-agent"
    ]
  },
  {
    "name": "VerificationAgent",
    "path": "./user-agent-objective-agents/VerificationAgent.js",
    "id": "verification-agent",
    "dependencies": [
      "decomposition-agent"
    ]
  },
  {
    "name": "IntegrationAgent",
    "path": "./user-agent-objective-agents/IntegrationAgent.js",
    "id": "integration-agent",
    "dependencies": []
  },
  {
    "name": "SynthesisAgent",
    "path": "./user-agent-objective-agents/SynthesisAgent.js",
    "id": "synthesis-agent",
    "dependencies": [
      "prompt-analysis-agent",
      "intent-extraction-agent",
      "decomposition-framework-agent",
      "alignment-verification-agent",
      "breakdown-compilation-agent",
      "output-formatting-agent",
      "verification-agent",
      "integration-agent"
    ]
  },
  {
    "name": "OrchestratorAgent",
    "path": "./user-agent-objective-agents/OrchestratorAgent.js",
    "id": "orchestrator-agent",
    "dependencies": [
      "prompt-analysis-agent",
      "intent-extraction-agent",
      "decomposition-framework-agent",
      "alignment-verification-agent",
      "breakdown-compilation-agent",
      "output-formatting-agent",
      "verification-agent",
      "integration-agent",
      "synthesis-agent"
    ]
  }
];
