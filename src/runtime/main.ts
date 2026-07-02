import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import { makeOpenAiLlm } from "../llm/gateway";
import { Ontology } from "../shared/types";
import { runOntology } from "./orchestrator";

dotenv.config();

async function main() {
  const prompt = process.argv.slice(2).join(" ");
  if (!prompt) {
    console.error('Usage: npm run run-agents "<your prompt>"');
    process.exit(1);
  }
  const token = process.env.OPEN_AI_TOKEN;
  if (!token) {
    console.error("OPEN_AI_TOKEN is not set.");
    process.exit(1);
  }

  const ontologyPath = path.join(__dirname, "..", "ontology.json");
  const ontology: Ontology = JSON.parse(fs.readFileSync(ontologyPath, "utf8"));
  const llm = makeOpenAiLlm(new OpenAI({ apiKey: token }));

  const result = await runOntology(llm, ontology, prompt);
  if (result.escaped) {
    console.log("[note] Prompt fell outside this system's frame; answered directly.\n");
  } else {
    console.log(`[agents run: ${result.planned.join(", ")}]\n`);
    if (result.unverified.length > 0) {
      console.log(`[caution] output from these agents never passed the rubric: ${result.unverified.join(", ")}\n`);
    }
  }
  console.log(result.answer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
