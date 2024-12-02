// src/types/llmTypes.ts

export interface Message {
    content: string;
    role: "user" | "assistant" | "system";
  }
  
  export interface Conversation {
    messages: Message[];
  }
  
  export interface LLMClient {
    sendMessage(conversation: Conversation, model?: string, temperature?: number): Promise<string>;
    sendMessageWithStream(conversation: Conversation, model?: string, temperature?: number): Promise<string>;
  }
  