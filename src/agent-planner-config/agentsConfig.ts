// config/agentsConfig.js

module.exports = [
  {
    "name": "ProblemAnalysisAgent",
    "path": "./agent-planner-agents/ProblemAnalysisAgent.js",
    "id": "problem-analysis-agent",
    "dependencies": []
  },
  {
    "name": "TaskDecompositionAgent",
    "path": "./agent-planner-agents/TaskDecompositionAgent.js",
    "id": "task-decomposition-agent",
    "dependencies": []
  },
  {
    "name": "AgentDesignAgent",
    "path": "./agent-planner-agents/AgentDesignAgent.js",
    "id": "agent-design-agent",
    "dependencies": [
      "task-decomposition-agent"
    ]
  },
  {
    "name": "CommunicationIntegrationAgent",
    "path": "./agent-planner-agents/CommunicationIntegrationAgent.js",
    "id": "communication-integration-agent",
    "dependencies": [
      "agent-design-agent"
    ]
  },
  // {
  //   "name": "ValidationOptimizationAgent",
  //   "path": "./agent-planner-agents/ValidationOptimizationAgent.js",
  //   "id": "validation-optimization-agent",
  //   "dependencies": []
  // },
  {
    "name": "OrchestratorAgent",
    "path": "./agent-planner-agents/OrchestratorAgent.js",
    "id": "orchestrator-agent",
    "dependencies": [
      "problem-analysis-agent",
      "task-decomposition-agent",
      "agent-design-agent",
      "communication-integration-agent",
      // "validation-optimization-agent"
    ]
  }
];
