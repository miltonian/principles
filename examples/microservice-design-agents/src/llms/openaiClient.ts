// src/llms/openaiClient.ts
import { OpenAI } from "openai";
import { Conversation, LLMClient } from "../types/llmTypes";
import { cleanOpenAIResponse } from "../utils/responseUtils";
import { escapeUnescapedBackticks } from "../utils/stringUtils";

/**
 * Initializes the OpenAI client with the provided API key.
 * @param apiKey - Your OpenAI API key.
 * @returns An instance of the OpenAI client.
 * @throws Will throw an error if the API key is not provided.
 */
let openai: OpenAI | null = null;

export const initializeOpenAIClient = (apiKey: string): OpenAI => {
  if (!apiKey) {
    throw new Error("Failed to initiate OpenAI Client: API key is missing.");
  }
  openai = new OpenAI({ apiKey });
  return openai;
};

/**
 * Retrieves the initialized OpenAI client.
 * @returns The OpenAI client instance.
 * @throws Will throw an error if the client is not initialized.
 */
export const getOpenAIClient = (): OpenAI => {
  if (!openai) {
    throw new Error(
      "OpenAI client not initialized. Call initializeOpenAIClient first."
    );
  }
  return openai;
};

/**
 * Sends a message to OpenAI's ChatGPT and retrieves the response.
 * @param conversation - The conversation object containing user messages.
 * @param model - The OpenAI model to use (default: "gpt-4o-mini").
 * @param temperature - The sampling temperature.
 * @returns The response from ChatGPT.
 */
export const sendMessageToChatGPT = async (
  conversation: Conversation,
  model:
    | "gpt-3.5-turbo"
    | "gpt-4o"
    | "gpt-4o-mini"
    | "o1-mini"
    | "o1-preview" = "gpt-4o-mini",
  temperature?: number
): Promise<string> => {
  const openaiClient = getOpenAIClient();

  try {
    const completion = await openaiClient.chat.completions.create({
      messages: conversation.messages,
      model,
      temperature,
    });

    const resp = completion?.choices[0].message.content || "";
    console.debug("ChatGPT Response:", resp);
    return resp;
  } catch (err) {
    console.error("Error sending message to ChatGPT:", err);
    throw new Error("Failed to send message to ChatGPT.");
  }
};

/**
 * Sends a message to OpenAI's ChatGPT with streaming and retrieves the aggregated response.
 * @param conversation - The conversation object containing user messages.
 * @param model - The OpenAI model to use (default: "gpt-4o-mini").
 * @param temperature - The sampling temperature.
 * @returns The aggregated response from ChatGPT.
 */
export const sendMessageToChatGPTWithStream = async (
  conversation: Conversation,
  model: "gpt-3.5-turbo" | "gpt-4o" | "gpt-4o-mini" = "gpt-4o-mini",
  temperature?: number
): Promise<string> => {
  const openaiClient = getOpenAIClient();

  try {
    const completion = await openaiClient.chat.completions.create({
      messages: conversation.messages,
      model,
      temperature,
      stream: true,
    });

    let message = "";
    for await (const event of completion) {
      if (event.choices[0].delta.content) {
        message += event.choices[0].delta.content;
      }
    }
    return message;
  } catch (err) {
    console.error("Error in streaming ChatGPT response:", err);
    throw new Error("Failed to stream message to ChatGPT.");
  }
};

/**
 * Example implementation of LLMClient interface for OpenAI.
 * Future LLMs can implement the same interface.
 */
export class OpenAILLMClient implements LLMClient {
  async sendMessage(
    conversation: Conversation,
    model?: string,
    temperature?: number
  ): Promise<string> {
    return sendMessageToChatGPT(conversation, model as any, temperature);
  }

  async sendMessageWithStream(
    conversation: Conversation,
    model?: string,
    temperature?: number
  ): Promise<string> {
    return sendMessageToChatGPTWithStream(
      conversation,
      model as any,
      temperature
    );
  }
}
