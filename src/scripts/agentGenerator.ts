import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();
import { initializeOpenAIClient } from '../llms/openaiClient';
import { handleAgentGeneration, getUserObjective } from '../services/agentGenerationService';

const main = async (promptArg?: string) => {
  const userPrompt = promptArg || process.argv.slice(2).join(' ');

  if (!userPrompt) {
    console.error('Please provide a user prompt.');
    process.exit(1);
  }

  // Initialize OpenAI client
  const openAIToken = process.env.OPEN_AI_TOKEN;
  if (!openAIToken) {
    console.error('OPEN_AI_TOKEN is not set.');
    process.exit(1);
  }
  initializeOpenAIClient(openAIToken);

  // Define base directories
  const BASE_DIR = path.join(__dirname, '..', '..');

  // Generate a unique package name
  const packageName = `agent-package-${Date.now()}`;
  const packageDir = path.join(BASE_DIR, 'packages', packageName);
  const srcDir = path.join(packageDir, 'src');
  const configDir = path.join(srcDir, 'config');
  const agentsDir = path.join(srcDir, 'agents');

// Create package directory and subdirectories
try {
  fs.ensureDirSync(agentsDir);
  console.log(`Created agents directory at ${agentsDir}`);

  fs.ensureDirSync(configDir);
  console.log(`Created config directory at ${configDir}`);
} catch (err) {
  console.error('Failed to create necessary directories:', err);
  process.exit(1);
}
  // Create package directory and subdirectories
  fs.mkdirSync(path.join(packageDir, 'src'), { recursive: true });

  // Initialize package.json
  const packageJson = {
    "name": packageName,
    "version": "1.0.0",
    "main": "dist/index.js",
    "license": "MIT",
    "dependencies": {
      "openai": "^4.70.2",
      "dotenv": "^16.4.5",
      "axios": "^1.7.7",
    },
    "devDependencies": {
      "@types/fs-extra": "^11.0.4",
      "dotenv-cli": "^4.0.0"
    },
    "scripts": {
      "build": "tsc",
      "run-agents": "yarn build && dotenv -e .env node src/testOrchestrator.js",
    }
  };
  
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // Copy tsconfig.json
  fs.copyFileSync(path.join(BASE_DIR, 'tsconfig.json'), path.join(packageDir, 'tsconfig.json'));

  // Handle agent generation
  try {

    // Create agentsConfig.ts with default content
    const agentsConfigPath = path.join(packageDir, 'src', 'config', 'agentsConfig.ts');
    const defaultAgentsConfigContent = `module.exports = [];`;
    fs.writeFileSync(agentsConfigPath, defaultAgentsConfigContent);
    console.log(`Created default agentsConfig.ts at ${agentsConfigPath}`);
    
    const userObjective = await getUserObjective(userPrompt);
    const generationResult = await handleAgentGeneration(userPrompt, userObjective, path.join(packageDir, 'src', 'config'), path.join(packageDir, 'src', 'agents'));

    // Copy utilities and scaffold
    fs.copySync(path.join(BASE_DIR, 'src', 'utils'), path.join(packageDir, 'src', 'utils'));
    fs.copySync(path.join(BASE_DIR, 'src', 'scaffold'), path.join(packageDir, 'src', 'scaffold'));
    fs.copySync(path.join(BASE_DIR, 'src', 'llms'), path.join(packageDir, 'src', 'llms'));
    fs.copySync(path.join(BASE_DIR, 'src', 'types'), path.join(packageDir, 'src', 'types'));
    fs.copySync(path.join(BASE_DIR, 'src', 'testOrchestrator.js'), path.join(packageDir, 'src', 'testOrchestrator.js'));
    fs.copySync(path.join(BASE_DIR, '.env'), path.join(packageDir, '.env'));

    // Create index.ts
    const indexContent = `
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
`;
    fs.writeFileSync(path.join(packageDir, 'src', 'index.ts'), indexContent);

    // Install dependencies and build package
    console.log(`Installing dependencies in ${packageDir}...`);
    execSync('yarn install', { cwd: packageDir, stdio: 'inherit' });

    console.log(`Building the package in ${packageDir}...`);
    execSync('yarn build', { cwd: packageDir, stdio: 'inherit' });

    console.log(`Package ${packageName} created successfully.`);
  } catch (error: any) {
    console.error('Error during agent generation:', error.message);
    process.exit(1);
  }
};

main();
