// src/user-agent-objective-agents/SynthesisAgent.ts

import { Agent } from '../scaffold'
import { sendMessageToChatGPT } from "../llms/openaiClient"
import {cleanOpenAIResponse} from '../utils/responseUtils'

/**
 * Synthesis Agent
 *
 * 
You are the SynthesisAgent. Your primary responsibility is to synthesize the outputs from all other agents to produce the most efficient, appropriate, and valuable output possible. Use the predefined output format specified below.

### Output Format:
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SynthesisAgentOutput",
  "type": "object",
  "properties": {
    "analysis": {
      "type": "object",
      "properties": {
        "analysisReport": {
          "type": "string",
          "description": "A comprehensive text report containing the structural analysis, content overview, contextual insights, intent confirmation, and preliminary insights derived from the user-provided prompt."
        },
        "metadata": {
          "type": "object",
          "properties": {
            "analysisTimestamp": {
              "type": "string",
              "format": "date-time",
              "description": "The timestamp indicating when the analysis was performed."
            },
            "agentId": {
              "type": "string",
              "description": "The unique identifier of the Prompt Analysis Agent performing the analysis."
            }
          },
          "required": [
            "analysisTimestamp",
            "agentId"
          ],
          "description": "Additional information about the analysis process."
        }
      },
      "required": [
        "analysisReport",
        "metadata"
      ],
      "description": "Output from the Prompt Analysis Agent."
    },
    "intent": {
      "type": "object",
      "properties": {
        "primaryIntent": {
          "type": "string",
          "description": "The main objective or goal expressed in the user prompt."
        },
        "secondaryIntents": {
          "type": "array",
          "items": {
            "type": "string",
            "description": "Additional motivations or objectives related to the main intent."
          },
          "description": "A list of secondary motivations or objectives extracted from the user prompt."
        },
        "confidenceScore": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "A score between 0 and 1 indicating the confidence level of the extracted intents."
        }
      },
      "required": [
        "primaryIntent",
        "secondaryIntents",
        "confidenceScore"
      ],
      "description": "Output from the Intent Extraction Agent."
    },
    "decompositionFramework": {
      "type": "object",
      "properties": {
        "frameworkName": {
          "type": "string",
          "description": "A concise name for the decomposition framework."
        },
        "principles": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "A list of first principles guiding the decomposition process."
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "stepNumber": {
                "type": "integer",
                "description": "The order of the step in the process."
              },
              "description": {
                "type": "string",
                "description": "A detailed explanation of the step."
              }
            },
            "required": [
              "stepNumber",
              "description"
            ]
          },
          "description": "A sequential list of steps outlining the decomposition methodology."
        },
        "guidelines": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Additional guidelines to ensure alignment with user intent and framework adaptability."
        },
        "adaptability": {
          "type": "object",
          "properties": {
            "promptTypes": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "List of prompt categories the framework can handle."
            },
            "customizationOptions": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "Available options for customizing the framework to specific needs."
            }
          },
          "description": "Details on how the framework can be adapted to different types of prompts."
        }
      },
      "required": [
        "frameworkName",
        "principles",
        "steps",
        "guidelines",
        "adaptability"
      ],
      "description": "Output from the Decomposition Framework Agent."
    },
    "alignmentVerification": {
      "type": "object",
      "properties": {
        "validationReport": {
          "type": "object",
          "properties": {
            "components": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "componentId": {
                    "type": "string",
                    "description": "Unique identifier for the component."
                  },
                  "description": {
                    "type": "string",
                    "description": "Detailed description of the component."
                  },
                  "isAligned": {
                    "type": "boolean",
                    "description": "Indicates whether the component aligns with the overarching goal."
                  },
                  "alignmentDetails": {
                    "type": "string",
                    "description": "Explanation of how the component aligns or does not align with the user's motivations."
                  }
                },
                "required": [
                  "componentId",
                  "description",
                  "isAligned",
                  "alignmentDetails"
                ]
              },
              "description": "List of components with their alignment status."
            },
            "summary": {
              "type": "object",
              "properties": {
                "totalComponents": {
                  "type": "integer",
                  "description": "Total number of components evaluated."
                },
                "alignedComponents": {
                  "type": "integer",
                  "description": "Number of components that are aligned with the overarching goal."
                },
                "misalignedComponents": {
                  "type": "integer",
                  "description": "Number of components that do not align with the overarching goal."
                }
              },
              "required": [
                "totalComponents",
                "alignedComponents",
                "misalignedComponents"
              ],
              "description": "Summary of the alignment verification process."
            },
            "errors": {
              "type": "array",
              "items": {
                "type": "string",
                "description": "List of error messages encountered during the verification process."
              },
              "description": "Any errors that occurred during processing."
            }
          },
          "required": [
            "components",
            "summary"
          ],
          "additionalProperties": false,
          "description": "Detailed validation report from the Alignment Verification Agent."
        }
      },
      "required": [
        "validationReport"
      ],
      "description": "Output from the Alignment Verification Agent."
    },
    "breakdown": {
      "type": "object",
      "properties": {
        "breakdown": {
          "type": "string",
          "description": "An exhaustive textual representation of the user's objectives and intents, combining all fundamental components into a coherent narrative."
        }
      },
      "required": [
        "breakdown"
      ],
      "description": "Output from the Breakdown Compilation Agent."
    },
    "formattedBreakdown": {
      "type": "object",
      "properties": {
        "formattedBreakdown": {
          "type": "string",
          "description": "A comprehensive and clearly structured text breakdown of the user's objective or intent."
        }
      },
      "required": [
        "formattedBreakdown"
      ],
      "description": "Output from the Output Formatting Agent."
    },
    "verification": {
      "type": "object",
      "properties": {
        "isValid": {
          "type": "boolean",
          "description": "Indicates whether the decomposition is both accurate and complete."
        },
        "missingComponents": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Lists any fundamental components that were expected but not identified in the decomposition."
        },
        "incorrectComponents": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Details any components that were identified inaccurately or do not align with the user's intent."
        },
        "validationComments": {
          "type": "string",
          "description": "Provides additional insights or comments on the decomposition quality and suggestions for improvement."
        },
        "timestamp": {
          "type": "string",
          "format": "date-time",
          "description": "The date and time when the validation was performed."
        }
      },
      "required": [
        "isValid",
        "timestamp"
      ],
      "description": "Output from the Verification Agent."
    },
    "finalBreakdown": {
      "type": "object",
      "properties": {
        "finalBreakdown": {
          "type": "string",
          "description": "An exhaustive textual breakdown of the user's original prompt, consolidating all fundamental components identified by the individual agents."
        }
      },
      "required": [
        "finalBreakdown"
      ],
      "description": "Output from the Integration Agent."
    }
  },
  "required": [
    "analysis",
    "intent",
    "decompositionFramework",
    "alignmentVerification",
    "breakdown",
    "formattedBreakdown",
    "verification",
    "finalBreakdown"
  ],
  "additionalProperties": false
}

### Instructions:
- Carefully review the outputs from all agents.
- Integrate the information to produce a final result.
- Ensure the output strictly adheres to the specified output format.
- Do not include any additional text or explanations outside the JSON format.

 */
class SynthesisAgent implements Agent {
  id: string 
  name: string 
  instructions: string 
  overarchingGoal: string
  toolVariables: {[name: string]: any} | undefined
  
  constructor() {
    this.id = "synthesis-agent";
    this.name = "Synthesis Agent";
    this.instructions = `
You are the SynthesisAgent. Your primary responsibility is to synthesize the outputs from all other agents to produce the most efficient, appropriate, and valuable output possible. Use the predefined output format specified below.

### Output Format:
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SynthesisAgentOutput",
  "type": "object",
  "properties": {
    "analysis": {
      "type": "object",
      "properties": {
        "analysisReport": {
          "type": "string",
          "description": "A comprehensive text report containing the structural analysis, content overview, contextual insights, intent confirmation, and preliminary insights derived from the user-provided prompt."
        },
        "metadata": {
          "type": "object",
          "properties": {
            "analysisTimestamp": {
              "type": "string",
              "format": "date-time",
              "description": "The timestamp indicating when the analysis was performed."
            },
            "agentId": {
              "type": "string",
              "description": "The unique identifier of the Prompt Analysis Agent performing the analysis."
            }
          },
          "required": [
            "analysisTimestamp",
            "agentId"
          ],
          "description": "Additional information about the analysis process."
        }
      },
      "required": [
        "analysisReport",
        "metadata"
      ],
      "description": "Output from the Prompt Analysis Agent."
    },
    "intent": {
      "type": "object",
      "properties": {
        "primaryIntent": {
          "type": "string",
          "description": "The main objective or goal expressed in the user prompt."
        },
        "secondaryIntents": {
          "type": "array",
          "items": {
            "type": "string",
            "description": "Additional motivations or objectives related to the main intent."
          },
          "description": "A list of secondary motivations or objectives extracted from the user prompt."
        },
        "confidenceScore": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "A score between 0 and 1 indicating the confidence level of the extracted intents."
        }
      },
      "required": [
        "primaryIntent",
        "secondaryIntents",
        "confidenceScore"
      ],
      "description": "Output from the Intent Extraction Agent."
    },
    "decompositionFramework": {
      "type": "object",
      "properties": {
        "frameworkName": {
          "type": "string",
          "description": "A concise name for the decomposition framework."
        },
        "principles": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "A list of first principles guiding the decomposition process."
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "stepNumber": {
                "type": "integer",
                "description": "The order of the step in the process."
              },
              "description": {
                "type": "string",
                "description": "A detailed explanation of the step."
              }
            },
            "required": [
              "stepNumber",
              "description"
            ]
          },
          "description": "A sequential list of steps outlining the decomposition methodology."
        },
        "guidelines": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Additional guidelines to ensure alignment with user intent and framework adaptability."
        },
        "adaptability": {
          "type": "object",
          "properties": {
            "promptTypes": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "List of prompt categories the framework can handle."
            },
            "customizationOptions": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "Available options for customizing the framework to specific needs."
            }
          },
          "description": "Details on how the framework can be adapted to different types of prompts."
        }
      },
      "required": [
        "frameworkName",
        "principles",
        "steps",
        "guidelines",
        "adaptability"
      ],
      "description": "Output from the Decomposition Framework Agent."
    },
    "alignmentVerification": {
      "type": "object",
      "properties": {
        "validationReport": {
          "type": "object",
          "properties": {
            "components": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "componentId": {
                    "type": "string",
                    "description": "Unique identifier for the component."
                  },
                  "description": {
                    "type": "string",
                    "description": "Detailed description of the component."
                  },
                  "isAligned": {
                    "type": "boolean",
                    "description": "Indicates whether the component aligns with the overarching goal."
                  },
                  "alignmentDetails": {
                    "type": "string",
                    "description": "Explanation of how the component aligns or does not align with the user's motivations."
                  }
                },
                "required": [
                  "componentId",
                  "description",
                  "isAligned",
                  "alignmentDetails"
                ]
              },
              "description": "List of components with their alignment status."
            },
            "summary": {
              "type": "object",
              "properties": {
                "totalComponents": {
                  "type": "integer",
                  "description": "Total number of components evaluated."
                },
                "alignedComponents": {
                  "type": "integer",
                  "description": "Number of components that are aligned with the overarching goal."
                },
                "misalignedComponents": {
                  "type": "integer",
                  "description": "Number of components that do not align with the overarching goal."
                }
              },
              "required": [
                "totalComponents",
                "alignedComponents",
                "misalignedComponents"
              ],
              "description": "Summary of the alignment verification process."
            },
            "errors": {
              "type": "array",
              "items": {
                "type": "string",
                "description": "List of error messages encountered during the verification process."
              },
              "description": "Any errors that occurred during processing."
            }
          },
          "required": [
            "components",
            "summary"
          ],
          "additionalProperties": false,
          "description": "Detailed validation report from the Alignment Verification Agent."
        }
      },
      "required": [
        "validationReport"
      ],
      "description": "Output from the Alignment Verification Agent."
    },
    "breakdown": {
      "type": "object",
      "properties": {
        "breakdown": {
          "type": "string",
          "description": "An exhaustive textual representation of the user's objectives and intents, combining all fundamental components into a coherent narrative."
        }
      },
      "required": [
        "breakdown"
      ],
      "description": "Output from the Breakdown Compilation Agent."
    },
    "formattedBreakdown": {
      "type": "object",
      "properties": {
        "formattedBreakdown": {
          "type": "string",
          "description": "A comprehensive and clearly structured text breakdown of the user's objective or intent."
        }
      },
      "required": [
        "formattedBreakdown"
      ],
      "description": "Output from the Output Formatting Agent."
    },
    "verification": {
      "type": "object",
      "properties": {
        "isValid": {
          "type": "boolean",
          "description": "Indicates whether the decomposition is both accurate and complete."
        },
        "missingComponents": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Lists any fundamental components that were expected but not identified in the decomposition."
        },
        "incorrectComponents": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Details any components that were identified inaccurately or do not align with the user's intent."
        },
        "validationComments": {
          "type": "string",
          "description": "Provides additional insights or comments on the decomposition quality and suggestions for improvement."
        },
        "timestamp": {
          "type": "string",
          "format": "date-time",
          "description": "The date and time when the validation was performed."
        }
      },
      "required": [
        "isValid",
        "timestamp"
      ],
      "description": "Output from the Verification Agent."
    },
    "finalBreakdown": {
      "type": "object",
      "properties": {
        "finalBreakdown": {
          "type": "string",
          "description": "An exhaustive textual breakdown of the user's original prompt, consolidating all fundamental components identified by the individual agents."
        }
      },
      "required": [
        "finalBreakdown"
      ],
      "description": "Output from the Integration Agent."
    }
  },
  "required": [
    "analysis",
    "intent",
    "decompositionFramework",
    "alignmentVerification",
    "breakdown",
    "formattedBreakdown",
    "verification",
    "finalBreakdown"
  ],
  "additionalProperties": false
}

### Instructions:
- Carefully review the outputs from all agents.
- Integrate the information to produce a final result.
- Ensure the output strictly adheres to the specified output format.
- Do not include any additional text or explanations outside the JSON format.
`;
    this.overarchingGoal = `{
  "goal": "given a user prompt, i want to design a set of agents using first principles thinking to break down the given user prompt into its most fundamental components. i need these components to specifically adhere to the users intent so the output of these agents specifically achieve what the user is aiming to do. the final output to return back to me from these agents should be an exhaustive breakdown of the user objective/intent in text format",
  "brokenDownGoal": "{\n  \"intent\": \"Break down user prompt into fundamental components and adhere to user intent\",\n  \"category\": \"Design and Analysis\",\n  \"primaryMotivation\": \"The user aims to systematically deconstruct a user prompt into its essential elements to ensure that the final output aligns precisely with the user's intent, thus facilitating clear and effective design and analysis.\",\n  \"secondaryMotivations\": [\n    {\n      \"id\": \"1\",\n      \"description\": \"Enhancing clarity in communication by ensuring outputs align with user expectations.\",\n      \"evidence\": \"The user emphasizes the importance of adhering to the user's intent, which indicates a motivation to enhance the clarity and effectiveness of the design process.\"\n    },\n    {\n      \"id\": \"2\",\n      \"description\": \"Encouraging system efficiency through a structured decomposition of prompts.\",\n      \"evidence\": \"The request to employ first principles thinking suggests a drive towards efficiency in generating outputs by breaking down the prompt into its fundamental components.\"\n    },\n    {\n      \"id\": \"3\",\n      \"description\": \"Facilitating informed decision-making based on a comprehensive understanding of user needs.\",\n      \"evidence\": \"The user’s desire for an exhaustive breakdown points to a motivation to gather detailed insights that support informed decision-making and design choices.\"\n    }\n  ],\n  \"evidence\": {\n    \"intentEvidence\": [\n      {\n        \"intent\": \"Break down user prompt into fundamental components and adhere to user intent\",\n        \"evidence\": \"i want to design a set of agents using first principles thinking to break down the given user prompt into its most fundamental components.\"\n      }\n    ],\n    \"primaryMotivationEvidence\": [],\n    \"secondaryMotivationEvidence\": []\n  },\n  \"validationFeedback\": \"Unavailable\",\n  \"validationDiscrepancies\": [],\n  \"actionsRequired\": \"None\"\n}"
}`;

    // Initialize tools
    

    // Initialize tool variables
    this.toolVariables = {};
  }

  /**
   * Processes the incoming prompt.
   *
   * @param {Object} prompt - The incoming prompt.
   * @param {Object} context - The context in which the prompt was received.
   * Contains agentOutputs and sharedData.
   * @returns {Promise<Object>} - The response after processing the prompt.
   */
  async processPrompt(prompt: {id: string; content: string}, context?: any) {
    const userInput = prompt.content || "";
    console.log({ userInput });

    const agentOutputs = context.agentOutputs || {};
    const sharedData = context.sharedData || {};
    const { variables } = context || {};

    // Merge toolVariables into variables
    const mergedVariables = { ...variables, ...this.toolVariables };

    // Example: Reading from sharedData
    // const relevantData = sharedData["someSharedKey"] || "default value";

    // Example: Writing to sharedData
    // sharedData["synthesis-agent_processedData"] = {
    //   timestamp: new Date().toISOString(),
    //   data: "Processed data by Synthesis Agent",
    //   inputReceived: userInput,
    // };

    // Determine if API calls are needed based on mergedVariables
    

    // Proceed if no API calls are needed or if the agent doesn't use the apiTool
    const customizedPrompt = `
You are an agent named Synthesis Agent. Your purpose is to 
You are the SynthesisAgent. Your primary responsibility is to synthesize the outputs from all other agents to produce the most efficient, appropriate, and valuable output possible. Use the predefined output format specified below.

### Output Format:
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SynthesisAgentOutput",
  "type": "object",
  "properties": {
    "analysis": {
      "type": "object",
      "properties": {
        "analysisReport": {
          "type": "string",
          "description": "A comprehensive text report containing the structural analysis, content overview, contextual insights, intent confirmation, and preliminary insights derived from the user-provided prompt."
        },
        "metadata": {
          "type": "object",
          "properties": {
            "analysisTimestamp": {
              "type": "string",
              "format": "date-time",
              "description": "The timestamp indicating when the analysis was performed."
            },
            "agentId": {
              "type": "string",
              "description": "The unique identifier of the Prompt Analysis Agent performing the analysis."
            }
          },
          "required": [
            "analysisTimestamp",
            "agentId"
          ],
          "description": "Additional information about the analysis process."
        }
      },
      "required": [
        "analysisReport",
        "metadata"
      ],
      "description": "Output from the Prompt Analysis Agent."
    },
    "intent": {
      "type": "object",
      "properties": {
        "primaryIntent": {
          "type": "string",
          "description": "The main objective or goal expressed in the user prompt."
        },
        "secondaryIntents": {
          "type": "array",
          "items": {
            "type": "string",
            "description": "Additional motivations or objectives related to the main intent."
          },
          "description": "A list of secondary motivations or objectives extracted from the user prompt."
        },
        "confidenceScore": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "A score between 0 and 1 indicating the confidence level of the extracted intents."
        }
      },
      "required": [
        "primaryIntent",
        "secondaryIntents",
        "confidenceScore"
      ],
      "description": "Output from the Intent Extraction Agent."
    },
    "decompositionFramework": {
      "type": "object",
      "properties": {
        "frameworkName": {
          "type": "string",
          "description": "A concise name for the decomposition framework."
        },
        "principles": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "A list of first principles guiding the decomposition process."
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "stepNumber": {
                "type": "integer",
                "description": "The order of the step in the process."
              },
              "description": {
                "type": "string",
                "description": "A detailed explanation of the step."
              }
            },
            "required": [
              "stepNumber",
              "description"
            ]
          },
          "description": "A sequential list of steps outlining the decomposition methodology."
        },
        "guidelines": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Additional guidelines to ensure alignment with user intent and framework adaptability."
        },
        "adaptability": {
          "type": "object",
          "properties": {
            "promptTypes": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "List of prompt categories the framework can handle."
            },
            "customizationOptions": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "Available options for customizing the framework to specific needs."
            }
          },
          "description": "Details on how the framework can be adapted to different types of prompts."
        }
      },
      "required": [
        "frameworkName",
        "principles",
        "steps",
        "guidelines",
        "adaptability"
      ],
      "description": "Output from the Decomposition Framework Agent."
    },
    "alignmentVerification": {
      "type": "object",
      "properties": {
        "validationReport": {
          "type": "object",
          "properties": {
            "components": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "componentId": {
                    "type": "string",
                    "description": "Unique identifier for the component."
                  },
                  "description": {
                    "type": "string",
                    "description": "Detailed description of the component."
                  },
                  "isAligned": {
                    "type": "boolean",
                    "description": "Indicates whether the component aligns with the overarching goal."
                  },
                  "alignmentDetails": {
                    "type": "string",
                    "description": "Explanation of how the component aligns or does not align with the user's motivations."
                  }
                },
                "required": [
                  "componentId",
                  "description",
                  "isAligned",
                  "alignmentDetails"
                ]
              },
              "description": "List of components with their alignment status."
            },
            "summary": {
              "type": "object",
              "properties": {
                "totalComponents": {
                  "type": "integer",
                  "description": "Total number of components evaluated."
                },
                "alignedComponents": {
                  "type": "integer",
                  "description": "Number of components that are aligned with the overarching goal."
                },
                "misalignedComponents": {
                  "type": "integer",
                  "description": "Number of components that do not align with the overarching goal."
                }
              },
              "required": [
                "totalComponents",
                "alignedComponents",
                "misalignedComponents"
              ],
              "description": "Summary of the alignment verification process."
            },
            "errors": {
              "type": "array",
              "items": {
                "type": "string",
                "description": "List of error messages encountered during the verification process."
              },
              "description": "Any errors that occurred during processing."
            }
          },
          "required": [
            "components",
            "summary"
          ],
          "additionalProperties": false,
          "description": "Detailed validation report from the Alignment Verification Agent."
        }
      },
      "required": [
        "validationReport"
      ],
      "description": "Output from the Alignment Verification Agent."
    },
    "breakdown": {
      "type": "object",
      "properties": {
        "breakdown": {
          "type": "string",
          "description": "An exhaustive textual representation of the user's objectives and intents, combining all fundamental components into a coherent narrative."
        }
      },
      "required": [
        "breakdown"
      ],
      "description": "Output from the Breakdown Compilation Agent."
    },
    "formattedBreakdown": {
      "type": "object",
      "properties": {
        "formattedBreakdown": {
          "type": "string",
          "description": "A comprehensive and clearly structured text breakdown of the user's objective or intent."
        }
      },
      "required": [
        "formattedBreakdown"
      ],
      "description": "Output from the Output Formatting Agent."
    },
    "verification": {
      "type": "object",
      "properties": {
        "isValid": {
          "type": "boolean",
          "description": "Indicates whether the decomposition is both accurate and complete."
        },
        "missingComponents": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Lists any fundamental components that were expected but not identified in the decomposition."
        },
        "incorrectComponents": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Details any components that were identified inaccurately or do not align with the user's intent."
        },
        "validationComments": {
          "type": "string",
          "description": "Provides additional insights or comments on the decomposition quality and suggestions for improvement."
        },
        "timestamp": {
          "type": "string",
          "format": "date-time",
          "description": "The date and time when the validation was performed."
        }
      },
      "required": [
        "isValid",
        "timestamp"
      ],
      "description": "Output from the Verification Agent."
    },
    "finalBreakdown": {
      "type": "object",
      "properties": {
        "finalBreakdown": {
          "type": "string",
          "description": "An exhaustive textual breakdown of the user's original prompt, consolidating all fundamental components identified by the individual agents."
        }
      },
      "required": [
        "finalBreakdown"
      ],
      "description": "Output from the Integration Agent."
    }
  },
  "required": [
    "analysis",
    "intent",
    "decompositionFramework",
    "alignmentVerification",
    "breakdown",
    "formattedBreakdown",
    "verification",
    "finalBreakdown"
  ],
  "additionalProperties": false
}

### Instructions:
- Carefully review the outputs from all agents.
- Integrate the information to produce a final result.
- Ensure the output strictly adheres to the specified output format.
- Do not include any additional text or explanations outside the JSON format.


### User Prompt:
"${userInput}"

### Outputs from Other Agents (optional unless explicitly said is required):
${JSON.stringify(agentOutputs, null, 2)}

### Instructions:
- Carefully read the user prompt and the outputs from other agents.
- Use only the information provided in the user prompt and outputs from other agents.
- Do not request or expect any external documents or data sources.
- **Important**: Provide the output strictly in the JSON format specified below.
- **Output Validation**: Ensure that the output adheres to the defined JSON structure and accurately reflects the input data.
- **Error Handling**: If required data is missing or incomplete, respond with the error JSON format without fabricating data. Lean on the side that you have all the data that you need unless a requirement is specified that you need it but the actual data of that requirement is not included
- do not error if there is nothing that is explicitly marked as required
- Ensure that the output is valid JSON. Do not include any additional text, explanations, or comments outside the JSON structure.

### Expected Output Format:
- your response should be in valid json without any other text whatsoever in the response. your response should not include anything besides valid json. your response should only be in the json formats below:
- in your json, all of your numbers should be strings. for example, "1" instead of 1.
- do not include any comments in your response. your response should be valid json and comments should not be allowed

**On Success:**
{
  "agentId": "synthesis-agent",
  "status": "success",
  "data": {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SynthesisAgentOutput",
  "type": "object",
  "properties": {
    "analysis": {
      "type": "object",
      "properties": {
        "analysisReport": {
          "type": "string",
          "description": "A comprehensive text report containing the structural analysis, content overview, contextual insights, intent confirmation, and preliminary insights derived from the user-provided prompt."
        },
        "metadata": {
          "type": "object",
          "properties": {
            "analysisTimestamp": {
              "type": "string",
              "format": "date-time",
              "description": "The timestamp indicating when the analysis was performed."
            },
            "agentId": {
              "type": "string",
              "description": "The unique identifier of the Prompt Analysis Agent performing the analysis."
            }
          },
          "required": [
            "analysisTimestamp",
            "agentId"
          ],
          "description": "Additional information about the analysis process."
        }
      },
      "required": [
        "analysisReport",
        "metadata"
      ],
      "description": "Output from the Prompt Analysis Agent."
    },
    "intent": {
      "type": "object",
      "properties": {
        "primaryIntent": {
          "type": "string",
          "description": "The main objective or goal expressed in the user prompt."
        },
        "secondaryIntents": {
          "type": "array",
          "items": {
            "type": "string",
            "description": "Additional motivations or objectives related to the main intent."
          },
          "description": "A list of secondary motivations or objectives extracted from the user prompt."
        },
        "confidenceScore": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "A score between 0 and 1 indicating the confidence level of the extracted intents."
        }
      },
      "required": [
        "primaryIntent",
        "secondaryIntents",
        "confidenceScore"
      ],
      "description": "Output from the Intent Extraction Agent."
    },
    "decompositionFramework": {
      "type": "object",
      "properties": {
        "frameworkName": {
          "type": "string",
          "description": "A concise name for the decomposition framework."
        },
        "principles": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "A list of first principles guiding the decomposition process."
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "stepNumber": {
                "type": "integer",
                "description": "The order of the step in the process."
              },
              "description": {
                "type": "string",
                "description": "A detailed explanation of the step."
              }
            },
            "required": [
              "stepNumber",
              "description"
            ]
          },
          "description": "A sequential list of steps outlining the decomposition methodology."
        },
        "guidelines": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Additional guidelines to ensure alignment with user intent and framework adaptability."
        },
        "adaptability": {
          "type": "object",
          "properties": {
            "promptTypes": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "List of prompt categories the framework can handle."
            },
            "customizationOptions": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "Available options for customizing the framework to specific needs."
            }
          },
          "description": "Details on how the framework can be adapted to different types of prompts."
        }
      },
      "required": [
        "frameworkName",
        "principles",
        "steps",
        "guidelines",
        "adaptability"
      ],
      "description": "Output from the Decomposition Framework Agent."
    },
    "alignmentVerification": {
      "type": "object",
      "properties": {
        "validationReport": {
          "type": "object",
          "properties": {
            "components": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "componentId": {
                    "type": "string",
                    "description": "Unique identifier for the component."
                  },
                  "description": {
                    "type": "string",
                    "description": "Detailed description of the component."
                  },
                  "isAligned": {
                    "type": "boolean",
                    "description": "Indicates whether the component aligns with the overarching goal."
                  },
                  "alignmentDetails": {
                    "type": "string",
                    "description": "Explanation of how the component aligns or does not align with the user's motivations."
                  }
                },
                "required": [
                  "componentId",
                  "description",
                  "isAligned",
                  "alignmentDetails"
                ]
              },
              "description": "List of components with their alignment status."
            },
            "summary": {
              "type": "object",
              "properties": {
                "totalComponents": {
                  "type": "integer",
                  "description": "Total number of components evaluated."
                },
                "alignedComponents": {
                  "type": "integer",
                  "description": "Number of components that are aligned with the overarching goal."
                },
                "misalignedComponents": {
                  "type": "integer",
                  "description": "Number of components that do not align with the overarching goal."
                }
              },
              "required": [
                "totalComponents",
                "alignedComponents",
                "misalignedComponents"
              ],
              "description": "Summary of the alignment verification process."
            },
            "errors": {
              "type": "array",
              "items": {
                "type": "string",
                "description": "List of error messages encountered during the verification process."
              },
              "description": "Any errors that occurred during processing."
            }
          },
          "required": [
            "components",
            "summary"
          ],
          "additionalProperties": false,
          "description": "Detailed validation report from the Alignment Verification Agent."
        }
      },
      "required": [
        "validationReport"
      ],
      "description": "Output from the Alignment Verification Agent."
    },
    "breakdown": {
      "type": "object",
      "properties": {
        "breakdown": {
          "type": "string",
          "description": "An exhaustive textual representation of the user's objectives and intents, combining all fundamental components into a coherent narrative."
        }
      },
      "required": [
        "breakdown"
      ],
      "description": "Output from the Breakdown Compilation Agent."
    },
    "formattedBreakdown": {
      "type": "object",
      "properties": {
        "formattedBreakdown": {
          "type": "string",
          "description": "A comprehensive and clearly structured text breakdown of the user's objective or intent."
        }
      },
      "required": [
        "formattedBreakdown"
      ],
      "description": "Output from the Output Formatting Agent."
    },
    "verification": {
      "type": "object",
      "properties": {
        "isValid": {
          "type": "boolean",
          "description": "Indicates whether the decomposition is both accurate and complete."
        },
        "missingComponents": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Lists any fundamental components that were expected but not identified in the decomposition."
        },
        "incorrectComponents": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Details any components that were identified inaccurately or do not align with the user's intent."
        },
        "validationComments": {
          "type": "string",
          "description": "Provides additional insights or comments on the decomposition quality and suggestions for improvement."
        },
        "timestamp": {
          "type": "string",
          "format": "date-time",
          "description": "The date and time when the validation was performed."
        }
      },
      "required": [
        "isValid",
        "timestamp"
      ],
      "description": "Output from the Verification Agent."
    },
    "finalBreakdown": {
      "type": "object",
      "properties": {
        "finalBreakdown": {
          "type": "string",
          "description": "An exhaustive textual breakdown of the user's original prompt, consolidating all fundamental components identified by the individual agents."
        }
      },
      "required": [
        "finalBreakdown"
      ],
      "description": "Output from the Integration Agent."
    }
  },
  "required": [
    "analysis",
    "intent",
    "decompositionFramework",
    "alignmentVerification",
    "breakdown",
    "formattedBreakdown",
    "verification",
    "finalBreakdown"
  ],
  "additionalProperties": false
}
}

**On Error:**
{
  "agentId": "synthesis-agent",
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Detailed error message explaining what went wrong."
}
`;

    try {
      const completion = await sendMessageToChatGPT(
        { messages: [{ content: customizedPrompt, role: "user" }] },
        "gpt-4o-mini"
      );

      const responseText = cleanOpenAIResponse(completion.trim());

      // Ensure the response is valid JSON
      let metadata;
      try {
        metadata = JSON.parse(responseText);
      } catch (e) {
        console.error(`Agent undefined returned invalid JSON.`);
        metadata = { agentId: "synthesis-agent", status: "error", code: "INVALID_JSON", message: "The agent returned malformed JSON." };
      }

      // Validate presence of required fields
      if (!metadata.agentId || !metadata.status) {
        console.error(`Agent undefined returned incomplete data.`);
        metadata = { agentId: "synthesis-agent", status: "error", code: "INCOMPLETE_OUTPUT", message: "The agent returned incomplete data." };
      }

      console.log({ completion, metadata });
      return {
        promptId: prompt.id,
        content: "", // No content to return at this stage
        metadata: metadata,
      };
    } catch (error) {
      console.error(`Error in Synthesis Agent:`, error);
      return {
        promptId: prompt.id,
        content: "",
        metadata: {
          agentId: "synthesis-agent",
          status: "error",
          code: "PROCESSING_FAILED",
          message: "Failed to process prompt in Synthesis Agent."
        }
      };
    }
  }
}

module.exports = SynthesisAgent;

export default SynthesisAgent;
