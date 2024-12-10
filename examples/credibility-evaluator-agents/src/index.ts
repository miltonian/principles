
import dotenv from 'dotenv';
dotenv.config();

import { OrchestratorAgent } from './agents/OrchestratorAgent';

const orchestrator = new OrchestratorAgent();

async function main() {
  const prompt = {
    id: 'prompt-1',
    content: process.argv.slice(2).join(' ') || 'Default prompt content',
    metadata: {},
  };

  try {
    const result = await orchestrator.processPrompt(prompt);
    console.log('Orchestrator Output:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
