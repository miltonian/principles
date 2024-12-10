
// src/utils/codeUtils.ts
import fs from 'fs/promises';

/**
 * Minimizes the provided code by removing comments, extra whitespace, and simplifying functions.
 * @param code - The code string to minimize.
 * @returns The minimized code string.
 */
export const minimizeCode = (code: string): string => {
  // Remove comments
  code = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

  // Remove extra whitespace
  code = code.replace(/\s{2,}/g, " ");
  code = code.replace(/\s*([{};=()>,])\s*/g, "$1");

  // Simplify function declarations to arrow functions
  code = code.replace(
    /function\s+(\w+)\s*\(([^)]*)\)\s*\{([^}]*)\}/g,
    (match, fName, args, body) =>
      `${fName}=${args.trim()}=>${body.trim().replace(/return\s+/, "")}`
  );

  // Trim leading and trailing spaces
  return code.trim();
};

/**
 * Reads and returns the content of a file.
 * @param filePath - The path to the file.
 * @returns The file content as a string.
 * @throws Will throw an error if the file cannot be read.
 */
export const unminimizeCodeFromFile = async (filePath: string): Promise<string> => {
  try {
    const fileContents = await fs.readFile(filePath, "utf8");
    return fileContents;
  } catch (error) {
    console.error(`Error reading file at ${filePath}:`, error);
    return "";
  }
};
