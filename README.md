<img src="logo.svg" height="200" alt="Principles Framework Logo">

# Principles Framework

Principles is a powerful and flexible framework that enables you to generate specialized AI agents based on a goal or problem statement. By applying **first principles thinking**, Principles breaks down your goal into its most fundamental truths or components—the smallest, indivisible parts of the problem. It then generates a network of collaborating agents that address each fundamental component. This approach allows you to create highly effective AI solutions tailored to your specific needs, enabling you to process subsequent prompts with greater accuracy and efficiency than general-purpose language models.

**Note:** This framework was designed as an experiment, and the code may require refining in some places.

For a more exhaustive discussion of the Principles Framework, explore the [blog post here](https://alexanderhamilton.me/blog/principles-framework-generate-ai-agents-using-first-principles-reasoning).

## Influences

This framework was heavily influenced by the following:

- [OpenAI Swarm](https://github.com/openai/swarm)
- [Breaking Down Complexity: A Journey into Multi-Agent Systems and the Future of Collaborative AI](https://medium.com/p/77fd7707bdf5)

## Table of Contents

- [Principles Framework](#principles-framework)
  - [Influences](#influences)
  - [Table of Contents](#table-of-contents)
  - [Recent Enhancements](#recent-enhancements)
  - [Features](#features)
  - [Installation](#installation)
    - [Prerequisites](#prerequisites)
    - [Steps](#steps)
  - [Getting Started](#getting-started)
  - [Usage](#usage)
    - [Generating Agents](#generating-agents)
    - [Running the Agents](#running-the-agents)
  - [Architecture Overview](#architecture-overview)
    - [Agents and Their Roles](#agents-and-their-roles)
    - [Orchestrator Agent and Agent Coordination](#orchestrator-agent-and-agent-coordination)
    - [Agent Registry and Dynamic Agent Loading](#agent-registry-and-dynamic-agent-loading)
  - [How It Works](#how-it-works)
  - [Detailed Workflow of Agent Generation and Execution](#detailed-workflow-of-agent-generation-and-execution)
  - [Advanced Features and Functionality](#advanced-features-and-functionality)
  - [Extensibility and Integration](#extensibility-and-integration)
  - [Error Handling and Validation](#error-handling-and-validation)
  - [Simplified Example Workflow](#simplified-example-workflow)
    - [Step 1: Generate Agents Based on a Goal or Problem Statement](#step-1-generate-agents-based-on-a-goal-or-problem-statement)
    - [Step 2: Use the Agents to Process Prompts](#step-2-use-the-agents-to-process-prompts)
  - [Iterative Refinement and Integration](#iterative-refinement-and-integration)
  - [Troubleshooting](#troubleshooting)
    - [1. Circular Dependencies When Running Agents](#1-circular-dependencies-when-running-agents)
    - [2. Importance of First Principles Thinking](#2-importance-of-first-principles-thinking)
    - [3. Accessing o1 Models on OpenAI](#3-accessing-o1-models-on-openai)
  - [Validation and Supporting Evidence](#validation-and-supporting-evidence)
    - [1. Dynamic Task Decomposition](#1-dynamic-task-decomposition)
    - [2. Iterative Problem-Solving and Adaptability](#2-iterative-problem-solving-and-adaptability)
  - [Limitations and Future Enhancements](#limitations-and-future-enhancements)
  - [Contributing](#contributing)
  - [License](#license)

## Recent Enhancements

- **Iterative Refinement of Fundamental Truths and Subtasks**:  
  The framework can now iteratively refine both the fundamental truths and the subtasks. If initial truths prove insufficient or if subtasks are not minimal or feasible, it can re-derive truths or re-decompose tasks as needed. This ensures that the final solution is always built upon stable, minimal, and actionable components.

- **Feasibility Checks for Subtasks**:  
  The decomposition logic now ensures that subtasks remain within the capabilities of a text-based assistant. Instead of producing unfeasible instructions (e.g., external physical actions), it focuses on tasks the agents can realistically handle, such as generating summaries, analyses, or structured proposals.

- **Comprehensive Agent Descriptions for Prompt Generation**:  
  The final integrated output now includes exhaustively detailed agent descriptions. Each agent specification is rich in context, instructions, constraints, and examples—enabling you to directly transform these final descriptions into robust prompts for creating or configuring agents in your downstream workflows.

These enhancements maintain and build upon the original core idea of using first principles reasoning to design specialized agents, while ensuring an adaptive, iterative refinement process and producing final outputs that are both minimal and extremely prompt-ready.

## Features

- **First Principles Decomposition**: Break down your goal into fundamental truths and minimal subtasks.
- **Iterative Refinement**: Dynamically re-derive truths or refine subtasks if initial attempts are insufficient or misaligned.
- **Feasibility Assurance**: Ensures subtasks are strictly within the realm of a text-based assistant’s capabilities.
- **Rich Final Output**: Produces highly detailed agent definitions, ready to be turned into prompts for agent instantiation.
- **Execution Order & Dependency Management**: Uses sophisticated algorithms to determine the optimal execution order of agents.
- **Error Handling & Validation**: Provides robust error handling, standardized JSON formats, and iterative improvements to correct issues.
- **Parallel Execution**: Agents without dependencies can run in parallel for performance gains.

## Installation

### Prerequisites

- **Node.js**: Version 14 or higher
- **npm** or **Yarn**: npm v6+ or Yarn v1.22+
- **OpenAI API Key**: Required for GPT models

### Steps

1. **Clone the Repository**

   ```bash
   git clone https://github.com/miltonian/principles.git
   cd principles
   ```

2. **Install Dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set Up Environment Variables**

   Create a `.env` file in the root directory and add your OpenAI API key:
   ```env
   OPEN_AI_TOKEN=your-openai-api-key
   ```

4. **Check `.env` in `.gitignore`**

   Ensure `.env` is in `.gitignore` to avoid committing sensitive data.

## Getting Started

Principles takes your goal or problem statement and applies first principles reasoning to identify fundamental truths and minimal subtasks. Through iterative refinement, it ensures these fundamental pieces are stable, aligned, and feasible for a text-based assistant. The final output includes a thoroughly documented set of agents, allowing you to directly generate effective prompts or seamlessly integrate the agents into your solution.

## Usage

### Generating Agents

```bash
npm run generate-agents "I want to design a multi-agent system using first principles thinking."
```

This command:
- Derives fundamental truths from your goal.
- Decomposes the goal into minimal subtasks.
- Iteratively refines truths or tasks if needed, ensuring both are minimal and actionable.
- Produces a package in `packages/` containing the generated agents and all necessary configurations, complete with comprehensive agent specifications.

### Running the Agents

After generating agents, you can run them against new prompts:

```bash
cd packages/<generated-agent-directory>/
npm run run-agents "How should these agents adapt if the project's constraints change?"
```

The agents respond with results grounded in refined truths and minimal subtasks. The final breakdown includes extensive agent descriptions, enabling you to directly craft prompts for new agents.

## Architecture Overview

### Agents and Their Roles

Within Principles, agents address distinct aspects of your goal’s decomposition. While the framework uses a variety of conceptual agents (such as those analyzing the problem, decomposing tasks, designing communication strategies, and generating agent designs), the newly introduced iterative refinement logic ensures that by the time you have your final agents, every fundamental assumption and subtask has been verified and adjusted if necessary.

### Orchestrator Agent and Agent Coordination

The **OrchestratorAgent** orchestrates execution, resolves dependencies, and manages iterative refinements. If necessary, it re-derives truths or re-decomposes tasks until everything is minimal and aligned.

### Agent Registry and Dynamic Agent Loading

The registry allows dynamic loading of agents, enabling flexible scaling and customization. With iterative refinement ensuring stable final outputs, you can trust that what’s loaded is coherent and ready for use.

## How It Works

1. **Provide a Goal**: Supply a clear objective or problem statement.
2. **First Principles Reasoning**: Identify fundamental truths and minimal subtasks.
3. **Iterative Refinement**: If something’s off, re-check truths or tasks to achieve stable, minimal results.
4. **Finalize Agents**: Produce a final set of agents, thoroughly documented for immediate prompt generation or integration.

## Detailed Workflow of Agent Generation and Execution

1. **Intent Extraction & Fundamental Truths**: Understand the user’s goals and establish core assumptions.
2. **Task Decomposition & Iterative Refinement**: Break down the goal into subtasks, and if needed, refine truths or tasks again.
3. **Integration**: Combine everything into a final, detail-rich agent output that can directly feed into prompt creation.

## Advanced Features and Functionality

- **Iterative Refinement Loops**: Continues refining until minimal, feasible, and aligned conditions are met.
- **Strict Feasibility**: Prevents agents from receiving impossible subtasks.
- **Comprehensive Agent Data**: Each agent’s final definition is so thorough you can immediately create prompts from it.

## Extensibility and Integration

The final result is a package of agents you can integrate into larger workflows or use as blueprints for generating agent prompts. The in-depth final specifications enable seamless adoption in any downstream application.

## Error Handling and Validation

The framework uses standardized JSON errors and adheres to strict validation checks. If subtasks or truths are problematic, iterative refinement corrects them before finalization, reducing manual debugging.

## Simplified Example Workflow

### Step 1: Generate Agents Based on a Goal or Problem Statement

**Command:**
```bash
npm run generate-agents "I want to design a multi-agent system using first principles thinking."
```

**Process:**
- Extracts intent, derives fundamental truths.
- Decomposes the problem into minimal subtasks.
- Iteratively refines both truths and subtasks if initial attempts aren’t optimal.
- Produces a package with fully documented agents.

**Outcome:**  
You get a new directory in `packages/` containing your agents and their configurations.

### Step 2: Use the Agents to Process Prompts

**Command:**
```bash
cd packages/<generated-agent-directory>/
npm run run-agents "How should these agents adapt if the project's constraints change?"
```

**Result:**
- The agents respond coherently, aligned with refined truths and minimal subtasks.
- The final breakdown includes complete agent descriptions, enabling direct prompt creation for future agents.

## Iterative Refinement and Integration

Iterative refinement ensures that the fundamental truths and subtasks aren’t just derived once but revisited until stable. This process guarantees that the final agent set is minimal, accurate, and fully detailed, so you can immediately leverage the final agent descriptions as powerful prompt templates.

## Troubleshooting

### 1. Circular Dependencies When Running Agents

If you encounter circular dependencies:
- Follow the existing guidelines to identify and remove cycles.
- The iterative refinement may help stabilize the order, but manual edits in `agentsConfig.ts` might still be required.

### 2. Importance of First Principles Thinking

First principles drive every step:
- Decompose your goal into undeniable truths and minimal tasks.
- Iterative refinement ensures these fundamentals stay correct and aligned, improving outcomes and reducing complexity.

### 3. Accessing o1 Models on OpenAI

If you need o1 models but encounter access issues:
- Refer to the provided instructions on contacting support or substituting another model.
- The iterative and prompt-ready nature of the framework remains effective regardless of the underlying model.

## Validation and Supporting Evidence

### 1. Dynamic Task Decomposition

Research confirms that dynamic decomposition enhances problem-solving success. Our iterative refinement aligns with these findings, ensuring tasks remain consistently minimal and aligned.

### 2. Iterative Problem-Solving and Adaptability

Studies on adaptive, iterative approaches show that refining fundamentals and tasks over multiple passes leads to better, more coherent results. This framework embraces that adaptability, producing final agents you can trust.

## Limitations and Future Enhancements

While now more adaptive, feasible, and exhaustive in output:
- Further heuristics could refine when to re-check truths vs. re-run decomposition.
- Additional logging or instrumentation could enhance transparency.
- Exploring broader integration with retrieval-augmented generation (RAG) or other data sources may further improve the process.

## Contributing

Contributions are welcome. If you have ideas for better heuristics, improved logging, or richer final agent definitions, follow the [Contributing](#contributing) guidelines to submit your enhancements.

## License

Principles is released under the [MIT License](LICENSE).

