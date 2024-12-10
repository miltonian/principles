// config/agentsConfig.ts

module.exports = [
  {
    "name": "SourceCredibilityAssessor",
    "path": "./agents/SourceCredibilityAssessor.js",
    "id": "source-credibility-assessor",
    "dependencies": []
  },
  {
    "name": "SampleSizeEvaluator",
    "path": "./agents/SampleSizeEvaluator.js",
    "id": "sample-size-evaluator",
    "dependencies": [
      "source-credibility-assessor"
    ]
  },
  {
    "name": "ControlGroupEvaluator",
    "path": "./agents/ControlGroupEvaluator.js",
    "id": "control-group-evaluator",
    "dependencies": [
      "statistical-analysis-evaluator",
      "source-credibility-assessor"
    ]
  },
  {
    "name": "RandomizationEvaluator",
    "path": "./agents/RandomizationEvaluator.js",
    "id": "randomization-evaluator",
    "dependencies": [
      "statistical-analysis-evaluator"
    ]
  },
  {
    "name": "DataCollectionMethodsEvaluator",
    "path": "./agents/DataCollectionMethodsEvaluator.js",
    "id": "data-collection-methods-evaluator",
    "dependencies": [
      "statistical-analysis-evaluator"
    ]
  },
  {
    "name": "PeerReviewStatusChecker",
    "path": "./agents/PeerReviewStatusChecker.js",
    "id": "peer-review-status-checker",
    "dependencies": [
      "statistical-analysis-evaluator"
    ]
  },
  {
    "name": "StatisticalAnalysisEvaluator",
    "path": "./agents/StatisticalAnalysisEvaluator.js",
    "id": "statistical-analysis-evaluator",
    "dependencies": [
      "agent-2",
      "agent-3",
      "agent-4",
      "agent-5",
      "agent-6"
    ]
  },
  {
    "name": "FindingsContextualizationAgent",
    "path": "./agents/FindingsContextualizationAgent.js",
    "id": "findings-contextualization-agent",
    "dependencies": [
      "conclusion-justification-evaluator"
    ]
  },
  {
    "name": "LimitationsDisclosureChecker",
    "path": "./agents/LimitationsDisclosureChecker.js",
    "id": "limitations-disclosure-checker",
    "dependencies": [
      "conclusion-justification-evaluator"
    ]
  },
  {
    "name": "ConclusionJustificationEvaluator",
    "path": "./agents/ConclusionJustificationEvaluator.js",
    "id": "conclusion-justification-evaluator",
    "dependencies": [
      "agent-7",
      "agent-8",
      "agent-9",
      "agent-10",
      "agent-11"
    ]
  },
  {
    "name": "SynthesisAgent",
    "path": "./agents/SynthesisAgent.js",
    "id": "synthesis-agent",
    "dependencies": [
      "source-credibility-assessor",
      "sample-size-evaluator",
      "control-group-evaluator",
      "randomization-evaluator",
      "data-collection-methods-evaluator",
      "peer-review-status-checker",
      "statistical-analysis-evaluator",
      "findings-contextualization-agent",
      "limitations-disclosure-checker",
      "conclusion-justification-evaluator"
    ]
  },
  {
    "name": "OrchestratorAgent",
    "path": "./agents/OrchestratorAgent.js",
    "id": "orchestrator-agent",
    "dependencies": [
      "source-credibility-assessor",
      "sample-size-evaluator",
      "control-group-evaluator",
      "randomization-evaluator",
      "data-collection-methods-evaluator",
      "peer-review-status-checker",
      "statistical-analysis-evaluator",
      "findings-contextualization-agent",
      "limitations-disclosure-checker",
      "conclusion-justification-evaluator",
      "synthesis-agent"
    ]
  }
];
