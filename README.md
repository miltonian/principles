<img src="logo.svg" height="200" alt="Principles Framework Logo">

# Principles Framework

Principles is a powerful and flexible framework that enables you to generate specialized AI agents based on a **singular goal** or problem statement. By applying **first principles thinking**, Principles breaks down your goal into its most fundamental truths or components—the smallest, indivisible parts of the problem. It then generates a network of collaborating agents that address each fundamental component. This approach allows you to create highly effective AI solutions tailored to your specific needs, enabling you to process subsequent prompts with greater accuracy and efficiency than general-purpose language models.

**Note:** This framework was designed as an experiment, and the code may require refining in some places.

## Influences

This framework was heavily influenced by the following:

- [OpenAI Swarm](https://github.com/openai/swarm)
- [AI Thinking: How to Design Agents That Think Like Humans](https://medium.com/p/77fd7707bdf5)

## Table of Contents

- [Principles Framework](#principles-framework)
  - [Influences](#influences)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [How It Works](#how-it-works)
  - [Installation](#installation)
    - [Prerequisites](#prerequisites)
    - [Steps](#steps)
  - [Getting Started](#getting-started)
  - [Usage](#usage)
    - [Generating Agents](#generating-agents)
    - [Running the Agents](#running-the-agents)
  - [(Highly Simplified) Example Workflow](#highly-simplified-example-workflow)
    - [Step 1: Generate Agents Based on a Singular Goal](#step-1-generate-agents-based-on-a-singular-goal)
    - [Step 2: Use the Agents to Process Prompts](#step-2-use-the-agents-to-process-prompts)
  - [Iterative Refinement and Integration](#iterative-refinement-and-integration)
  - [Troubleshooting](#troubleshooting)
    - [1. Circular Dependencies When Running Agents](#1-circular-dependencies-when-running-agents)
    - [2. Importance of First Principles Thinking](#2-importance-of-first-principles-thinking)
  - [Contributing](#contributing)
  - [License](#license)

## Features

- **First Principles Decomposition**: Break down your singular goal into its most fundamental truths or components—the smallest, indivisible parts of the problem.
- **Automated Agent Generation**: Generate specialized agents that address each fundamental component of your goal.
- **Enhanced Performance**: Agents are tailored to your specific problem, enabling more effective processing of subsequent prompts.
- **Modular and Extensible Design**: Build complex systems by integrating generated agents into larger workflows or nesting them within other agents.
- **Iterative Development**: Refine and improve agents over time to enhance their capabilities.
- **OpenAI Integration**: Leverage the power of OpenAI's GPT models for advanced natural language processing.

## How It Works

1. **Input a Singular Goal**: Provide a clear and specific goal or problem statement you wish to address.

2. **First Principles Breakdown**: Principles applies first principles thinking to deconstruct your goal into its most fundamental truths or components—the smallest elements that cannot be reduced further.

   - **First Principles Thinking**: A problem-solving approach that involves breaking down complex problems into their most basic, fundamental elements. By understanding these core components, you can build solutions from the ground up without relying on assumptions or conventional methods.

3. **Agent Generation**: Each fundamental component is converted into a specialized agent designed to address that specific aspect.

4. **Agent Collaboration**: The agents work together to solve the overall goal, providing more accurate and efficient results.

5. **Process Subsequent Prompts**: Use the generated agents to process prompts related to your goal, benefiting from their specialized design that targets the fundamental aspects of the problem.

## Installation

### Prerequisites

- **Node.js**: Version 14 or higher
- **npm** or **Yarn**: npm version 6 or higher, or Yarn version 1.22 or higher
- **OpenAI API Key**: You need an OpenAI API key to use the GPT models.

### Steps

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/principles.git
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

4. **(Optional) Ensure `.env` is Ignored in Version Control**

   Make sure your `.gitignore` includes the `.env` file to prevent it from being committed:

   ```gitignore
   node_modules/
   dist/
   .env
   ```

## Getting Started

Principles allows you to generate specialized AI agents by providing a **singular, well-defined goal** or problem statement. By applying first principles thinking, Principles breaks down your goal into its most basic, fundamental components—the smallest building blocks of the problem. It then generates agents that address each of these fundamental components. These agents collaborate to solve your overall goal and can process subsequent prompts more effectively than general-purpose language models.

## Usage

### Generating Agents

To generate agents based on your singular goal, use the `generate-agents` script:

```bash
npm run generate-agents "Your singular goal or problem statement here."
# or
yarn generate-agents "Your singular goal or problem statement here."
```

**Example:**

```bash
npm run generate-agents "I want to optimize my daily schedule to improve productivity."
```

This script will:

- **Process Your Singular Goal**: Understand your specific objective.
- **First Principles Breakdown**: Decompose your goal into its most fundamental components.
  - **Fundamental Components**: In this example, components might include time management, task prioritization, and energy level assessment.
- **Generate Specialized Agents**: Create agents designed to address each fundamental component.
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
- **Run the Agents**: Execute the agents to process your prompt.
- **Display Results**: Show the response generated by the agents.

## (Highly Simplified) Example Workflow

### Step 1: Generate Agents Based on a Singular Goal

**Command:**

```bash
npm run generate-agents "I want to improve my productivity by optimizing my daily schedule."
```

**What This Does:**

- **First Principles Breakdown**: Decomposes your goal into the most fundamental components:
  - **Time Management**: Efficient allocation of time slots.
  - **Task Prioritization**: Identifying high-impact tasks.
  - **Energy Level Assessment**: Aligning tasks with peak energy periods.
- **Generates Specialized Agents**:
  - **Time Management Agent**: Suggests optimal time allocation.
  - **Task Prioritization Agent**: Ranks tasks based on importance and urgency.
  - **Energy Assessment Agent**: Aligns tasks with your energy levels throughout the day.
- **Creates a New Package**:
  - A package directory is created under `packages/` with a unique name.
  - Includes all necessary configurations and code.

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
- **Integrate into Other Agents**: Use generated agents as components within other agents to build more complex systems.
- **Improve Performance**: Continuously refine and test the agents based on feedback from their outputs.

**Example:**

You may want to include a new fundamental component like **Distraction Management**:

1. **Add a Distraction Management Agent**:

   - Create a new agent focused on identifying and minimizing distractions.

2. **Integrate the New Agent**:

   - Update the orchestrator to include the Distraction Management Agent in the workflow.

3. **Test and Refine**:

   - Run the agents with new prompts and refine as needed.

## Troubleshooting

### 1. Circular Dependencies When Running Agents

**Issue:**

Encountering errors related to circular dependencies when running the agents.

**What is a Circular Dependency?**

A circular dependency occurs when two or more agents depend on each other, directly or indirectly, creating a loop that prevents proper execution.

**How to Fix Circular Dependencies:**

1. **Identify the Circular Dependency:**

   - Open the `agentsConfig.ts` file in the `config` directory of your generated package.
   - Look for agents that list each other as dependencies.

2. **Resolve the Dependency Loop:**

   - Modify the dependencies to remove the circular reference.
   - Ensure that each agent depends only on agents executed before it.

3. **Re-run the Agents:**

   - After resolving the dependencies, run the `run-agents` command again.

**Tip:**

- If you're unsure how to fix the dependencies, you can copy the `agentsConfig.ts` content and use an LLM to help identify and resolve the issue. That's what I normally do.

### 2. Importance of First Principles Thinking

**Understanding First Principles Thinking:**

First principles thinking is a problem-solving approach that involves breaking down complex problems into their most basic, fundamental elements—components that cannot be reduced further. This method allows you to build solutions from the ground up, free from assumptions and conventional wisdom.

**Why It Matters in Principles:**

- **Effective Decomposition**: By applying first principles thinking, Principles ensures that your singular goal is broken down into the smallest, most fundamental components. This leads to a more precise and effective set of agents.
- **Customized Solutions**: Addressing the fundamental components allows for the creation of specialized agents that are finely tuned to your specific problem.
- **Enhanced Collaboration**: Agents built from first principles can collaborate more effectively, as each one addresses a distinct aspect of the problem.

**Best Practices:**

- **Define a Singular, Well-Defined Goal**: Provide a clear and specific problem statement to allow effective decomposition.
- **Focus on Fundamental Components**: Think about the smallest elements that make up your problem.
- **Avoid Assumptions**: Challenge existing beliefs and focus on what is fundamentally true about your problem.

**Example:**

Instead of stating:

"I want to improve my company's customer service and increase sales."

Focus on a singular goal:

"I want to enhance the customer support experience by reducing response times."

This allows Principles to break down the goal into fundamental components like response time analysis, support ticket prioritization, and automated reply suggestions.

## Contributing

We welcome contributions to enhance Principles. To contribute:

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

   Implement your feature or fix the bug.

4. **Commit Your Changes**

   ```bash
   git commit -m "Add feature: Your feature description"
   ```

5. **Push to Your Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Submit a Pull Request**

   Go to the original repository on GitHub and create a pull request from your fork.

**Please ensure that your code follows the project's coding standards and includes appropriate tests.**

## License

Principles is released under the [MIT License](LICENSE).

---

By following this updated README, you can generate specialized agents using Principles based on a **singular goal**, leveraging first principles thinking to break it down into its most fundamental truths or components. The generated agents collaborate to address each component, allowing you to process subsequent prompts with greater accuracy and efficiency.

**Note:** This framework was designed as an experiment, and the code may require refining in some places.

**Feel free to experiment with different singular goals to generate agents that suit your application requirements. Remember, focusing on the most fundamental aspects of your problem helps Principles assist you more effectively.**

---

**Additional Example Singular Goals:**

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
