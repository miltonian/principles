// config/agentsConfig.ts

module.exports = [
  {
    "name": "RequirementElicitationAgent",
    "path": "./agents/RequirementElicitationAgent.js",
    "id": "requirement-elicitation-agent",
    "dependencies": []
  },
  {
    "name": "BoundedContextDefinitionAgent",
    "path": "./agents/BoundedContextDefinitionAgent.js",
    "id": "bounded-context-definition-agent",
    "dependencies": [
      "domain-identification-agent"
    ]
  },
  {
    "name": "ScalabilityAndPerformanceEvaluationAgent",
    "path": "./agents/ScalabilityAndPerformanceEvaluationAgent.js",
    "id": "scalability-and-performance-evaluation-agent",
    "dependencies": [
      "microservice-boundary-determination-agent"
    ]
  },
  {
    "name": "InterServiceCommunicationAnalysisAgent",
    "path": "./agents/InterServiceCommunicationAnalysisAgent.js",
    "id": "inter-service-communication-analysis-agent",
    "dependencies": [
      "microservice-boundary-determination-agent"
    ]
  },
  {
    "name": "FinalRecommendationAgent",
    "path": "./agents/FinalRecommendationAgent.js",
    "id": "final-recommendation-agent",
    "dependencies": [
      "requirement-elicitation-agent",
      "domain-identification-agent",
      "bounded-context-definition-agent",
      "entity-relationship-analysis-agent",
      "microservice-boundary-determination-agent",
      "scalability-performance-evaluation-agent",
      "inter-service-communication-analysis-agent",
      "data-management-strategy-agent",
      "maintainability-assessment-agent"
    ]
  },
  {
    "name": "SynthesisAgent",
    "path": "./agents/SynthesisAgent.js",
    "id": "synthesis-agent",
    "dependencies": [
      "requirement-elicitation-agent",
      "bounded-context-definition-agent",
      "scalability-and-performance-evaluation-agent",
      "inter-service-communication-analysis-agent",
      "final-recommendation-agent"
    ]
  },
  {
    "name": "OrchestratorAgent",
    "path": "./agents/OrchestratorAgent.js",
    "id": "orchestrator-agent",
    "dependencies": [
      "requirement-elicitation-agent",
      "bounded-context-definition-agent",
      "scalability-and-performance-evaluation-agent",
      "inter-service-communication-analysis-agent",
      "final-recommendation-agent",
      "synthesis-agent"
    ]
  }
];
