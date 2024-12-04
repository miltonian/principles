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
  - [Validation and Supporting Evidence](#validation-and-supporting-evidence)
    - [1. Dynamic Task Decomposition](#1-dynamic-task-decomposition)
    - [2. Iterative Problem-Solving and Adaptability](#2-iterative-problem-solving-and-adaptability)
  - [Limitations and Future Enhancements](#limitations-and-future-enhancements)
  - [Contributing](#contributing)
  - [License](#license)

## Features

- **First Principles Decomposition**: Break down your goal into its most fundamental truths using first principles thinking.
- **Automated Agent Generation**: Dynamically create specialized agents that address each fundamental component of your goal.
- **Modular and Extensible Design**: The framework's architecture allows for easy customization and expansion.
- **Execution Order and Dependency Management**: Uses advanced algorithms to determine agent execution order based on dependencies.
- **Error Handling and Validation**: Robust mechanisms ensure agents operate reliably and outputs are validated.
- **Parallel Agent Execution**: Agents without dependencies can run in parallel for performance optimization.

## Installation

### Prerequisites

- **Node.js**: Version 14 or higher
- **npm** or **Yarn**: npm version 6 or higher, or Yarn version 1.22 or higher
- **OpenAI API Key**: You need an OpenAI API key to use the GPT models.

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

4. **Ensure `.env` is Ignored in Version Control**

   Verify that your `.gitignore` includes the `.env` file to prevent it from being committed:

   ```gitignore
   node_modules/
   dist/
   .env
   ```

## Getting Started

Principles allows you to generate specialized AI agents by providing a **well-defined goal or problem statement**. By applying first principles thinking, Principles breaks down your goal into its most basic, fundamental components—the smallest building blocks of the problem. It then generates agents that address each of these fundamental components. These agents collaborate to solve your overall goal and can process subsequent prompts more effectively than general-purpose language models.

## Usage

### Generating Agents

To generate agents based on your goal or problem statement, use the `generate-agents` script:

```bash
npm run generate-agents "Your goal or problem statement here."
# or
yarn generate-agents "Your goal or problem statement here."
```

**Example:**

```bash
npm run generate-agents "I want to optimize my daily schedule to improve productivity."
```

This script will:

- **Process Your Goal or Problem Statement**: Understand your specific objective.
- **First Principles Breakdown**: Decompose your goal into its most fundamental components using the `TaskDecompositionAgent`.
- **Generate Specialized Agents**: Use the `AgentDesignAgent` to create agents designed to address each fundamental component.
- **Define Agent Interactions**: The `CommunicationIntegrationAgent` sets up how agents will interact.
- **Create a Package**: Generate a new package containing the agents and configurations.

### Running the Agents

After generating the agents, you can use them to process prompts related to your goal. The agents, designed based on the fundamental components of your goal, will handle these prompts more effectively.

To run the agents with a test prompt:

```bash
cd packages/<generated-agent-directory>/

npm run run-agents "Your test prompt here."
# or
yarn run-agents "Your test prompt here."
```

**Example:**

```bash
cd packages/agent-package-1633036800000/
npm run run-agents "Here is my list of tasks for today: write a report, attend a meeting, respond to emails, and plan the next project. How should I prioritize them to maximize productivity?"
```

This script will:

- **Compile the Project**: Ensure that all generated agents are compiled.
- **Run the Agents**: The `OrchestratorAgent` executes the agents to process your prompt.
- **Display Results**: Show the response generated by the agents, synthesized by the `SynthesisAgent`.

## Architecture Overview

The Principles Framework is built around an orchestrated network of specialized agents, each designed to address a fundamental component of the user's goal or problem statement. The framework ensures efficient coordination and execution of these agents to produce a coherent and valuable output.

### Agents and Their Roles

Here is a detailed explanation of the primary agents within the framework and their specific roles:

- **`AgentDesignAgent`**: Designs distinct agents with unique purposes based on fundamental components identified by the `TaskDecompositionAgent`.
- **`ProblemAnalysisAgent`**: Analyzes user requirements to identify key goals, challenges, and desired outcomes.
- **`TaskDecompositionAgent`**: Breaks down complex problems into fundamental components using first principles thinking.
- **`CommunicationIntegrationAgent`**: Defines communication protocols and integration strategies for the multi-agent system.
- **`SynthesisAgent`**: Synthesizes outputs from all other agents to produce the final result.
- **`AlignmentVerificationAgent`**: Ensures that each component aligns with the overarching user objective.
- **`BreakdownCompilationAgent`**: Compiles identified and verified fundamental components into a comprehensive textual breakdown.
- **`DecompositionFrameworkAgent`**: Develops a structured methodology for decomposing user prompts into fundamental components.
- **`IntentExtractionAgent`**: Identifies and isolates the core objectives and intentions behind a user prompt.

### Orchestrator Agent and Agent Coordination

The **`OrchestratorAgent`** plays a crucial role in the framework by coordinating all primary agents and synthesizing their outputs:

- **Execution Order Resolution**: Uses dependency graphs and topological sorting (e.g., Kahn's algorithm) to determine the execution order of agents based on their dependencies.
- **Agent Registration**: Dynamically imports and registers agents based on the configuration files.
- **Parallel Execution**: Groups agents into execution levels, allowing agents without dependencies to run in parallel.
- **Error Handling**: Implements retry logic and robust error handling mechanisms for agent execution.

### Agent Registry and Dynamic Agent Loading

The **`AgentRegistry`** is responsible for:

- **Agent Management**: Registers and manages instances of agents, facilitating efficient retrieval and execution.
- **Dynamic Loading**: Allows for dynamic loading and registration of agents at runtime based on configuration files.

## How It Works

1. **Input a Goal or Problem Statement**: Provide a clear and specific goal or problem statement you wish to address.

2. **First Principles Breakdown**: The `TaskDecompositionAgent` uses first principles thinking to deconstruct your goal into its most fundamental components.

3. **Agent Generation**: The `AgentDesignAgent` designs specialized agents, each targeting a fundamental component identified.

4. **Agent Coordination and Integration**: The `CommunicationIntegrationAgent` defines how agents will interact and share information.

5. **Execution Management**: The `OrchestratorAgent` resolves dependencies, manages execution order, and coordinates the operation of all agents.

6. **Synthesis of Outputs**: The `SynthesisAgent` combines outputs from all agents to produce the final, coherent result.

## Detailed Workflow of Agent Generation and Execution

1. **User Objective Definition**: The `IntentExtractionAgent` captures and processes user objectives from the provided prompt.

2. **Task Decomposition**: The `TaskDecompositionAgent` breaks down the problem into fundamental components using first principles thinking.

3. **Agent Design and Communication**:

   - **Agent Design**: The `AgentDesignAgent` creates specialized agents for each fundamental component.
   - **Communication Integration**: The `CommunicationIntegrationAgent` defines how agents will interact and share information.

4. **Execution Order Resolution**: The `OrchestratorAgent` resolves dependencies between agents using Kahn's algorithm and groups agents into execution levels.

5. **Agent Execution**:

   - **Parallel Execution**: Agents at the same execution level run in parallel if they have no dependencies.
   - **Retry Logic**: Implements retry mechanisms and error handling for robustness.

6. **Synthesis of Outputs**: The `SynthesisAgent` integrates outputs from various agents to produce the final result.

## Advanced Features and Functionality

- **Execution Order and Dependency Management**: Intelligent resolution of agent execution order based on dependencies.

- **Error Handling and Validation Mechanisms**: Agents return errors in a standardized JSON format, and outputs are validated against expected schemas.

- **Parallel Agent Execution**: Enhances performance by running independent agents concurrently.

- **Shared Data Contexts**: Agents can read and write to shared data contexts for efficient data sharing.

- **Agent Templates and Customization**:

  - **Templates**: Use `GenericAgentTemplate` and `OrchestratorAgentTemplate` to create custom agents.
  - **Customization**: Modify templates to create agents tailored to specific needs.

## Extensibility and Integration

The framework is designed for easy extension and integration:

- **Adding New Agents**: Create new agent classes and register them in the `agentsConfig.ts` file.

- **Integration with Other Systems**: Agents can be integrated into larger workflows or interact with external services.

- **Customization**: Users can modify existing agents or create new ones to suit their specific application requirements.

## Error Handling and Validation

- **Structured Error Responses**: Agents return errors in a standardized JSON format for consistency.

- **Output Validation**: Ensures that agent outputs adhere to expected formats and structures, preventing downstream errors.

- **Retry Mechanisms**: Agents implement retry logic and backoff strategies to handle transient failures.

## Simplified Example Workflow

### Step 1: Generate Agents Based on a Goal or Problem Statement

**Command:**

```bash
npm run generate-agents "I want to improve my productivity by optimizing my daily schedule."
```

**What This Does:**

- **First Principles Breakdown**: Decomposes your goal into the most fundamental components:
  - **Time Management**
  - **Task Prioritization**
  - **Energy Level Assessment**
- **Generates Specialized Agents**:
  - **Time Management Agent**
  - **Task Prioritization Agent**
  - **Energy Assessment Agent**
- **Defines Agent Interactions**: Sets up communication protocols between agents.
- **Creates a New Package**: A package directory is created under `packages/` with all necessary configurations and code.

### Step 2: Use the Agents to Process Prompts

**Command:**

```bash
cd packages/agent-package-1633036800000/
npm run run-agents "I have high energy in the mornings and tend to feel sluggish after lunch. My tasks today are writing a report, team meeting, and responding to emails. What's the best schedule for me?"
```

**Expected Output:**

```
Agent Output:
{
  "optimizedSchedule": [
    {
      "time": "9:00 AM - 11:00 AM",
      "task": "Writing the report",
      "reason": "High-priority task aligned with peak energy levels."
    },
    {
      "time": "11:30 AM - 12:30 PM",
      "task": "Team meeting",
      "reason": "Collaborative task scheduled before lunch."
    },
    {
      "time": "2:00 PM - 4:00 PM",
      "task": "Responding to emails",
      "reason": "Less demanding task scheduled during lower energy period."
    }
  ],
  "additionalSuggestions": [
    "Take a short walk after lunch to boost energy.",
    "Prioritize deep work tasks in the morning."
  ]
}
```

**Interpreting the Output:**

- **Optimized Schedule**: A schedule that aligns tasks with your energy levels and prioritizes important tasks.
- **Reasons Provided**: Each scheduling decision is backed by reasoning based on fundamental components.
- **Additional Suggestions**: Tips to further enhance productivity.

## Iterative Refinement and Integration

Principles allows you to refine the generated agents or integrate them into larger workflows:

- **Customize Agents**: Modify the agents' code to enhance their capabilities or better suit your preferences.

- **Integrate into Other Systems**: Use generated agents as components within other systems or workflows.

- **Improve Performance**: Continuously refine and test the agents based on feedback from their outputs.

**Example:**

You may want to include a new fundamental component like **Distraction Management**:

1. **Add a Distraction Management Agent**:

   - Create a new agent focused on identifying and minimizing distractions.

2. **Integrate the New Agent**:

   - Update the orchestrator and `agentsConfig.ts` to include the new agent.

3. **Test and Refine**:

   - Run the agents with new prompts and refine as needed.

## Troubleshooting

### 1. Circular Dependencies When Running Agents

**Issue:**

Encountering errors related to circular dependencies when running the agents.

**What is a Circular Dependency?**

A circular dependency occurs when two or more agents depend on each other, directly or indirectly, creating a loop that prevents proper execution.

**Solution:**

1. **Identify the Circular Dependency**:

   - Open the `agentsConfig.ts` file in the `config` directory of your generated package.
   - Look for agents that list each other as dependencies.

2. **Resolve the Dependency Loop**:

   - Modify the dependencies to remove the circular reference.
   - Ensure that each agent depends only on agents executed before it.

3. **Re-run the Agents**:

   - After resolving the dependencies, run the `run-agents` command again.

**Tip:**

- If you're unsure how to fix the dependencies, you can copy the `agentsConfig.ts` content and use an LLM to help identify and resolve the issue.

### 2. Importance of First Principles Thinking

**Understanding First Principles Thinking:**

First principles thinking involves breaking down complex problems into their most basic, fundamental elements. This method allows you to build solutions from the ground up, free from assumptions and conventional wisdom.

**Why It Matters in Principles:**

- **Effective Decomposition**: Ensures your goal is broken down into fundamental components, leading to more precise agents.

- **Customized Solutions**: Specialized agents are finely tuned to your specific problem.

- **Enhanced Collaboration**: Agents built from first principles can collaborate more effectively.

**Best Practices:**

- **Define a Singular, Well-Defined Goal**: Provide a clear and specific problem statement.

- **Focus on Fundamental Components**: Think about the smallest elements that make up your problem.

- **Avoid Assumptions**: Challenge existing beliefs and focus on fundamental truths.

## Validation and Supporting Evidence

The methodologies underpinning the **Principles Framework** are strongly validated by research studies demonstrating the effectiveness of decomposition-based frameworks. Key findings from these studies provide evidence for the power and utility of the Principles approach:

### 1. Dynamic Task Decomposition

The Principles Framework's focus on breaking down complex goals into their most fundamental components aligns with results from the **TDAG (Dynamic Task Decomposition and Agent Generation)** framework:

- **TDAG Results**:
  - Achieved up to **33% improvement** in success rates on compositional reasoning tasks.
  - **28.3% increase** in task completion rates in dynamic environments (ALFWorld benchmark).
  - **27% performance boost** on interactive tasks (WebShop benchmark).
- **Key Advantages**:
  - **Dynamic Adaptability**: TDAG dynamically decomposes tasks and generates custom subagents, enhancing adaptability in complex, real-world tasks.
  - **Error Reduction**: Significant reduction in error rates, particularly in cascading task failures, due to dynamic adjustments and specialized subagents.

[Reference: TDAG Framework and ItineraryBench](https://arxiv.org/abs/2402.10178)

### 2. Iterative Problem-Solving and Adaptability

The iterative and adaptive nature of the Principles Framework is reinforced by studies on modular problem-solving systems:

- **Dynamic Role Discovery and Assignment (DRDA)**:
  - Improved task allocation efficiency by **20%-30%** using dynamic role assignment in multi-agent systems.
  - **Performance Gains**: Achieved higher win rates in complex scenarios, demonstrating the effectiveness of dynamic role policies and restricted action spaces.
- **Key Insights**:
  - Dynamic role assignment allows agents to adapt to changing environments and tasks.
  - Role-specific policies enhance learning efficiency by reducing action space complexity.

[Reference: Dynamic Role Discovery and Assignment](https://link.springer.com/content/pdf/10.1007/s40747-023-01071-x.pdf)

## Limitations and Future Enhancements

While the Principles Framework offers robust features, it is important to acknowledge its limitations:

- **Experimental Nature**: The framework is experimental and may require refinement in certain areas.

- **Limited Error Messages**: Error handling is in place, but error messages may not always provide detailed guidance.

**Future Enhancements:**

- **Enhanced Documentation**: More comprehensive guides and examples.

- **Performance Optimization**: Improve execution speed and efficiency.

- **Improved Task Decomposition**: I believe there is a lot of room for improvement here using reasoning with first principles as well as tools for research and RAG implementations to improve the planning of each individual agent.

- **More Tools**: More tools such as api and RAG implementations

- **Nested Agent Generation**: Make it easier to generate agents that fit inside other agents for more complex processing 

- **Community Contributions**: Encourage open-source contributions to expand functionality.

## Contributing

We welcome contributions to enhance the Principles Framework. To contribute:

1. **Fork the Repository**

   ```bash
   git clone https://github.com/miltonian/principles.git
   cd principles
   ```

2. **Create a New Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**

   Implement your feature or fix the bug. Please ensure your code follows the project's coding standards and includes appropriate tests.

4. **Run Tests**

   ```bash
   npm test
   # or
   yarn test
   ```

5. **Commit Your Changes**

   ```bash
   git commit -m "Add feature: Your feature description"
   ```

6. **Push to Your Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Submit a Pull Request**

   Go to the original repository on GitHub and create a pull request from your fork.

**Code Standards and Guidelines:**

- **Code Style**: Follow existing coding styles and best practices.

- **Testing**: Write unit tests for new features and ensure existing tests pass.

- **Documentation**: Update documentation and comments where appropriate.

- **Issue Tracking**: Use GitHub Issues to report bugs or request features.

## License

Principles is released under the [MIT License](LICENSE).

---

By following this README, you can generate specialized agents using Principles based on a **goal or problem statement**, leveraging first principles thinking to break it down into its most fundamental truths or components. The generated agents collaborate to address each component, allowing you to process subsequent prompts with greater accuracy and efficiency.

**Feel free to experiment with different goal or problem statements to generate agents that suit your application requirements. Remember, focusing on the most fundamental aspects of your problem helps Principles assist you more effectively.**

---

**Additional Examples:**

- **Generate Agents for Language Learning**

  ```bash
  npm run generate-agents "I want to learn French by practicing daily conversations."
  ```

  **Fundamental Components:**

  - **Vocabulary Acquisition**
  - **Grammar Understanding**
  - **Pronunciation Practice**

  **Test the Agents:**

  ```bash
  cd packages/<generated-agent-directory>/
  npm run run-agents "Can you help me practice ordering food in a French restaurant?"
  ```

- **Generate Agents for Health Monitoring**

  ```bash
  npm run generate-agents "I need an assistant that helps me monitor my daily water intake and reminds me to stay hydrated."
  ```

  **Fundamental Components:**

  - **Water Intake Tracking**
  - **Hydration Reminders**

  **Test the Agents:**

  ```bash
  cd packages/<generated-agent-directory>/
  npm run run-agents "I drank two glasses of water this morning."
  ```

---

**If you have any questions or need further assistance, please refer to the [Contributing](#contributing) section or open an issue on the repository.**

