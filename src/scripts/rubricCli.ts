import path from "path";
import dotenv from "dotenv";
dotenv.config();
import { makeClaudeAgentSdkLlm } from "../llm/claudeGateway";
import { compileRubric } from "../core/rubricCompiler";
import { writeRubricArtifacts } from "../core/rubricRender";

const main = async () => {
  const objective = process.argv.slice(2).join(" ");
  if (!objective) {
    console.error('Usage: yarn compile-rubric "<goal to compile a rubric for>"');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set — relying on local Claude Code credentials if available.");
  }

  const llm = makeClaudeAgentSdkLlm();
  console.log("Deriving and vetting truths, decomposing, compiling rubric...");
  const rubric = await compileRubric(llm, objective);

  if (rubric.assumptions.length > 0) {
    console.log("\nProceeding on these ASSUMPTIONS (correct me if wrong):");
    for (const a of rubric.assumptions) console.log(`  - ${a.statement}`);
  }
  if (rubric.rejectedTruths.length > 0) {
    console.log("\nRejected candidate truths:");
    for (const r of rubric.rejectedTruths) console.log(`  - "${r.statement}" — ${r.attack}`);
  }
  console.log(`\nDecomposition: ${rubric.decomposition.status} after ${rubric.decomposition.iterations} iteration(s).`);
  if (rubric.decomposition.status !== "converged") {
    console.log("  Decomposition did not fully converge — completeness criteria may be incomplete; review before trusting.");
  }

  console.log(`\nGradeability check: ${rubric.gradeability.status} after ${rubric.gradeability.iterations} iteration(s).`);
  if (rubric.gradeability.status !== "converged") {
    console.log("  The rubric did NOT fully pass its own meta-rubric — review it before trusting it.");
    if (rubric.gradeability.stuckOn?.length) {
      console.log(`  Stuck on meta-criteria: ${rubric.gradeability.stuckOn.join(", ")}`);
    }
  }

  const baseDir = path.join(__dirname, "..", "..");
  const out = writeRubricArtifacts(rubric, path.join(baseDir, "rubrics"));
  console.log(`\nRubric written:\n  ${out.mdPath}\n  ${out.jsonPath}`);
  console.log(`Criteria: ${rubric.criteria.length} (use rubric.md as an Outcome rubric; rubric.json carries provenance).`);
};

main().catch((err) => {
  console.error("Rubric compilation failed:", err.message);
  process.exit(1);
});
