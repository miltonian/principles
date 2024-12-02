// src/utils/responseUtils.ts
import { OpenAI } from 'openai';

/**
 * Cleans the raw response from OpenAI by removing unwanted characters and formatting.
 * @param rawResponseParam - The raw response string from OpenAI.
 * @returns The cleaned response string.
 */
export const cleanOpenAIResponse = (rawResponseParam: string, preserveNewLines?: boolean): string => {
  let rawResponse = rawResponseParam;

  if (rawResponse.startsWith('"') && rawResponse.endsWith('"')) {
    rawResponse = rawResponse.slice(1, -1);
  }

  if(preserveNewLines){
    return rawResponse
    .replace(/^```json\s*/, "")
    .replace(/^```javascript\s*/, "")
    .replace(/^```markdown\s*/, "")
    .replace(/```$/, "")
    .trim();
  }

  const cleaned = rawResponse
    .replace(/^```json\s*/, "")
    .replace(/^```javascript\s*/, "")
    .replace(/^```markdown\s*/, "")
    .replace(/```$/, "")
    .replace(/\\n/g, "")
    .replace(/\n/g, "")
    .trim();

  return cleaned;
};

/**
 * Extracts the system message content from a messages page.
 * @param messagesPage - The messages page from OpenAI threads.
 * @returns The combined content of the latest assistant message.
 */
export const getSystemMessageContent = (
  messagesPage: OpenAI.Beta.Threads.Messages.MessagesPage
): string => {
  const assistantMessages = messagesPage.data
    .filter(
      (d) => d.role === "assistant" && d.content[0].type === "text"
    )
    .map((d) => {
      const content = d.content[0];
      return "text" in content ? content.text.value : "";
    })
    .sort((a, b) => b.length - a.length); // Assuming createdAt corresponds to message length for simplicity

  return assistantMessages[0] || "";
};
