// testOrchestrator.js
// const PromptEnhancerOrchestratorAgent = require("./prompt-enhancer-agents/OrchestratorAgent"); // Adjust path as needed
const { OrchestratorAgent } = require("../dist/agents/OrchestratorAgent"); // Adjust path as needed
// const OrchestratorAgent = require("./user-agent-objective-agents/OrchestratorAgent"); // Adjust path as needed
// const OrchestratorAgent = require("./api-agents/OrchestratorAgent"); // Adjust path as needed
// const OrchestratorAgent = require("./synthesize-code-agents/OrchestratorAgent"); // Adjust path as needed

// Initialize the orchestrator
const orchestrator = new OrchestratorAgent();

/**
 * Runs the orchestrator with a sample prompt to test the entire workflow.
 */
async function testOrchestrator(promptArg) {
  const userPrompt = promptArg || process.argv.slice(2).join(" ");

  if(!userPrompt){
    throw new Error("Please provide a prompt as an argument to test the orchestrator.");
  }
  console.log("\n--- Testing Orchestrator ---");

  // Define a sample prompt to simulate user input
  const testPrompt = {
    id: "test-prompt-1",
    content: userPrompt,
    metadata: {}, // Add any additional metadata as needed
  };

  // Run the orchestrator agent
  try {
    const result = await orchestrator.processPrompt(testPrompt, {});
    console.log("\nOrchestrator Output:\n", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error during orchestrator execution:", error);
  }
}

testOrchestrator();
