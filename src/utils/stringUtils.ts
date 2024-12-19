// src/utils/stringUtils.ts

/**
 * Escapes unescaped backticks in a string.
 * @param input - The input string.
 * @returns The escaped string.
 */
export const escapeUnescapedBackticks = (input: string): string => {
    return input.replace(/(?<!\\)`/g, '\\`').replace(/\\\\`/g, '\\`');
  };
  