import { describe, it, expect } from "vitest";
import { deriveFoundations } from "../../src/core/foundations";
import { Llm, LlmRequest } from "../../src/llm/gateway";

/** Scripted fake dispatching on schemaName — same fixtures as the pipeline test. */
const scriptedLlm = (): Llm =>
  (async <T>(req: LlmRequest<T>) => {
    switch (req.schemaName) {
      case "landscape_survey":
        return { observations: [] };
      case "typed_truths":
        return { truths: [{ type: "constraint", statement: "must cite sources", rationale: "r", groundedIn: [] }] };
      case "truth_attack":
        return { verdict: "survives", strongestAttack: "none", justification: "solid" };
      case "decomposition":
        return {
          subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: false, webJustification: "" }],
          coverageMap: [{ dimension: "source credibility", handledBy: "1", exclusionReason: "" }],
        };
      case "rubric_verdicts":
        return {
          verdicts: [
            { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
            { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
            { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
            { criterionId: "d-web", pass: true, evidence: "no web requests made or all justified" },
            { criterionId: "d-breadth", pass: true, evidence: "map spans the topic" },
            { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
          ],
        };
      case "frame_challenges":
        return { challenges: [] };
      default:
        throw new Error(`unexpected schema ${req.schemaName}`);
    }
  }) as unknown as Llm;

describe("deriveFoundations", () => {
  it("includes the web request in the judge prompt so d-web can be verified", async () => {
    const capture: { prompt?: string } = {};
    const llm = (async <T>(req: LlmRequest<T>) => {
      switch (req.schemaName) {
        case "landscape_survey":
          return { observations: [] };
        case "typed_truths":
          return { truths: [{ type: "constraint", statement: "must cite sources", rationale: "r", groundedIn: [] }] };
        case "truth_attack":
          return { verdict: "survives", strongestAttack: "none", justification: "solid" };
        case "decomposition":
          return {
            subtasks: [
              {
                description: "fetch the paper",
                servesTruths: ["t1"],
                dependsOnIndices: [],
                needsWeb: true,
                webJustification: "the study text is external",
              },
            ],
            coverageMap: [{ dimension: "source credibility", handledBy: "1", exclusionReason: "" }],
          };
        case "rubric_verdicts":
          capture.prompt = (req as unknown as { prompt: string }).prompt;
          return {
            verdicts: [
              { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
              { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
              { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
              { criterionId: "d-web", pass: true, evidence: "web request is justified" },
              { criterionId: "d-breadth", pass: true, evidence: "map spans the topic" },
              { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
            ],
          };
        case "frame_challenges":
          return { challenges: [] };
        default:
          throw new Error(`unexpected schema ${req.schemaName}`);
      }
    }) as unknown as Llm;

    await deriveFoundations(llm, "evaluate study credibility");
    expect(capture.prompt).toContain("WEB REQUESTED: the study text is external");
  });

  it("includes a coverage-map row in the judge prompt so d-breadth can be verified", async () => {
    const capture: { prompt?: string } = {};
    const llm = (async <T>(req: LlmRequest<T>) => {
      switch (req.schemaName) {
        case "landscape_survey":
          return { observations: [] };
        case "typed_truths":
          return { truths: [{ type: "constraint", statement: "must cite sources", rationale: "r", groundedIn: [] }] };
        case "truth_attack":
          return { verdict: "survives", strongestAttack: "none", justification: "solid" };
        case "decomposition":
          return {
            subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: false, webJustification: "" }],
            coverageMap: [
              { dimension: "source credibility", handledBy: "1", exclusionReason: "" },
              { dimension: "publication bias", handledBy: "", exclusionReason: "out of scope for this objective" },
            ],
          };
        case "rubric_verdicts":
          capture.prompt = (req as unknown as { prompt: string }).prompt;
          return {
            verdicts: [
              { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
              { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
              { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
              { criterionId: "d-web", pass: true, evidence: "no web requests made or all justified" },
              { criterionId: "d-breadth", pass: true, evidence: "map spans the topic" },
              { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
            ],
          };
        case "frame_challenges":
          return { challenges: [] };
        default:
          throw new Error(`unexpected schema ${req.schemaName}`);
      }
    }) as unknown as Llm;

    await deriveFoundations(llm, "evaluate study credibility");
    expect(capture.prompt).toContain("Coverage map:");
    expect(capture.prompt).toContain("source credibility");
    expect(capture.prompt).toContain("publication bias");
    expect(capture.prompt).toContain("out of scope for this objective");
  });

  it("derives, vets, and decomposes without generating agent specs", async () => {
    const f = await deriveFoundations(scriptedLlm(), "evaluate study credibility");
    expect(f.truths).toHaveLength(1);
    expect(f.truths[0].id).toBe("t1");
    expect(f.vet.kept).toHaveLength(1);
    expect(f.vet.assumptions).toHaveLength(0);
    expect(f.subtasks).toHaveLength(1);
    expect(f.subtasks[0].id).toBe("s1");
    expect(f.decomposition.status).toBe("converged");
    expect(f.coverageMap).toEqual([{ dimension: "source credibility", handledBy: "s1", exclusionReason: "" }]);
    // No "agent_spec" schema was requested — the scripted fake would have thrown.
  });

  it("throws when every truth is rejected", async () => {
    const llm = (async <T>(req: LlmRequest<T>) => {
      if (req.schemaName === "landscape_survey") return { observations: [] };
      if (req.schemaName === "typed_truths")
        return { truths: [{ type: "fact", statement: "x", rationale: "r", groundedIn: [] }] };
      if (req.schemaName === "truth_attack")
        return { verdict: "reject", strongestAttack: "broken", justification: "j" };
      throw new Error(`unexpected schema ${req.schemaName}`);
    }) as unknown as Llm;
    await expect(deriveFoundations(llm, "obj")).rejects.toThrow(/no truths survived/i);
  });

  it("returns the survey and threads it into truths and skeptic prompts", async () => {
    const captured: { truthsPrompt?: string; attackPrompt?: string } = {};
    const llm = (async <T>(req: LlmRequest<T>) => {
      switch (req.schemaName) {
        case "landscape_survey":
          return {
            observations: [
              { kind: "genre-convention", statement: "explainer videos open with a hook", source: "YouTube creator handbooks" },
            ],
          };
        case "typed_truths":
          captured.truthsPrompt = (req as unknown as { prompt: string }).prompt;
          return { truths: [{ type: "constraint", statement: "must cite sources", rationale: "r", groundedIn: ["obs1"] }] };
        case "truth_attack":
          captured.attackPrompt = (req as unknown as { prompt: string }).prompt;
          return { verdict: "survives", strongestAttack: "none", justification: "solid" };
        case "decomposition":
          return {
            subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: false, webJustification: "" }],
            coverageMap: [{ dimension: "source credibility", handledBy: "1", exclusionReason: "" }],
          };
        case "rubric_verdicts":
          return {
            verdicts: [
              { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
              { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
              { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
              { criterionId: "d-web", pass: true, evidence: "no web requests made or all justified" },
              { criterionId: "d-breadth", pass: true, evidence: "map spans the topic" },
              { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
            ],
          };
        case "frame_challenges":
          return { challenges: [] };
        default:
          throw new Error(`unexpected schema ${req.schemaName}`);
      }
    }) as unknown as Llm;

    const f = await deriveFoundations(llm, "make a YouTube explainer");
    expect(f.survey).toEqual([
      { id: "obs1", kind: "genre-convention", statement: "explainer videos open with a hook", source: "YouTube creator handbooks" },
    ]);
    expect(f.truths[0].groundedIn).toEqual(["obs1"]);
    expect(captured.truthsPrompt).toContain("## CANDIDATE OBSERVATIONS (evidence, not premises — reject freely, cite if used)");
    expect(captured.truthsPrompt).toContain("obs1 [genre-convention] explainer videos open with a hook (YouTube creator handbooks)");
    expect(captured.attackPrompt).toContain(
      "## External observations (attack the truths WITH these in hand — and attack the observations themselves where they are weak)"
    );
    expect(captured.attackPrompt).toContain("obs1 [genre-convention] explainer videos open with a hook (YouTube creator handbooks)");
  });

  it("never leaks truths into the frame_challenges prompt (bait-truth absence)", async () => {
    const captured: { framePrompt?: string } = {};
    const baitStatement = "must never mention the secret sauce recipe XYZZY123";
    const llm = (async <T>(req: LlmRequest<T>) => {
      switch (req.schemaName) {
        case "landscape_survey":
          return { observations: [] };
        case "typed_truths":
          return { truths: [{ type: "constraint", statement: baitStatement, rationale: "r", groundedIn: [] }] };
        case "truth_attack":
          return { verdict: "survives", strongestAttack: "none", justification: "solid" };
        case "decomposition":
          return {
            subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: false, webJustification: "" }],
            coverageMap: [{ dimension: "source credibility", handledBy: "1", exclusionReason: "" }],
          };
        case "rubric_verdicts":
          return {
            verdicts: [
              { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
              { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
              { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
              { criterionId: "d-web", pass: true, evidence: "no web requests made or all justified" },
              { criterionId: "d-breadth", pass: true, evidence: "map spans the topic" },
              { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
            ],
          };
        case "frame_challenges":
          captured.framePrompt = (req as unknown as { prompt: string }).prompt;
          return { challenges: [] };
        default:
          throw new Error(`unexpected schema ${req.schemaName}`);
      }
    }) as unknown as Llm;

    await deriveFoundations(llm, "evaluate study credibility");
    expect(captured.framePrompt).toBeDefined();
    expect(captured.framePrompt).not.toContain(baitStatement);
  });

  it("zero challenges is a pass-through: no extra decomposition or judge call", async () => {
    let decompositionCalls = 0;
    let judgeCalls = 0;
    let frameCalls = 0;
    const llm = (async <T>(req: LlmRequest<T>) => {
      switch (req.schemaName) {
        case "landscape_survey":
          return { observations: [] };
        case "typed_truths":
          return { truths: [{ type: "constraint", statement: "must cite sources", rationale: "r", groundedIn: [] }] };
        case "truth_attack":
          return { verdict: "survives", strongestAttack: "none", justification: "solid" };
        case "decomposition":
          decompositionCalls++;
          return {
            subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: false, webJustification: "" }],
            coverageMap: [{ dimension: "source credibility", handledBy: "1", exclusionReason: "" }],
          };
        case "rubric_verdicts":
          judgeCalls++;
          return {
            verdicts: [
              { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
              { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
              { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
              { criterionId: "d-web", pass: true, evidence: "no web requests made or all justified" },
              { criterionId: "d-breadth", pass: true, evidence: "map spans the topic" },
              { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
            ],
          };
        case "frame_challenges":
          frameCalls++;
          return { challenges: [] };
        default:
          throw new Error(`unexpected schema ${req.schemaName}`);
      }
    }) as unknown as Llm;

    const f = await deriveFoundations(llm, "evaluate study credibility");
    expect(f.decomposition.status).toBe("converged");
    expect(decompositionCalls).toBe(1);
    expect(judgeCalls).toBe(1);
    expect(frameCalls).toBe(1);
  });

  it("with challenges: runs exactly one revision quoting the challenge text, and the judge candidate lists the challenges", async () => {
    let decompositionCalls = 0;
    let judgeCalls = 0;
    const capturedDecompositionPrompts: string[] = [];
    const capturedJudgePrompts: string[] = [];
    const challengeText = "no subtask covers the counterargument the genre demands";

    const llm = (async <T>(req: LlmRequest<T>) => {
      switch (req.schemaName) {
        case "landscape_survey":
          return { observations: [] };
        case "typed_truths":
          return { truths: [{ type: "constraint", statement: "must cite sources", rationale: "r", groundedIn: [] }] };
        case "truth_attack":
          return { verdict: "survives", strongestAttack: "none", justification: "solid" };
        case "decomposition":
          decompositionCalls++;
          capturedDecompositionPrompts.push((req as unknown as { prompt: string }).prompt);
          return {
            subtasks: [{ description: "analyze sources", servesTruths: ["t1"], dependsOnIndices: [], needsWeb: false, webJustification: "" }],
            coverageMap: [{ dimension: "source credibility", handledBy: "1", exclusionReason: "" }],
          };
        case "rubric_verdicts":
          judgeCalls++;
          capturedJudgePrompts.push((req as unknown as { prompt: string }).prompt);
          return {
            verdicts: [
              { criterionId: "d-minimal", pass: true, evidence: "single atomic analysis action" },
              { criterionId: "d-feasible", pass: true, evidence: "pure text analysis, no externals" },
              { criterionId: "d-complete", pass: true, evidence: "covers the whole objective" },
              { criterionId: "d-web", pass: true, evidence: "no web requests made or all justified" },
              { criterionId: "d-breadth", pass: true, evidence: "map spans the topic" },
              { criterionId: "d-t1", pass: true, evidence: "citation constraint carried into s1" },
            ],
          };
        case "frame_challenges":
          return { challenges: [{ kind: "missing-axis", challenge: challengeText }] };
        default:
          throw new Error(`unexpected schema ${req.schemaName}`);
      }
    }) as unknown as Llm;

    const f = await deriveFoundations(llm, "evaluate study credibility");

    expect(decompositionCalls).toBe(2); // initial + exactly one frame revision
    expect(judgeCalls).toBe(2); // initial + re-judge after revision

    // Revision prompt (2nd decomposition call) quotes the challenge, tagged with its frame-fcN criterion id.
    expect(capturedDecompositionPrompts[1]).toContain(challengeText);
    expect(capturedDecompositionPrompts[1]).toContain("frame-fc1");

    // Judge candidate for the revised decomposition lists the challenges (blind-judge lesson).
    expect(capturedJudgePrompts[1]).toContain("Frame challenges raised (each must be adopted or excluded-with-reason):");
    expect(capturedJudgePrompts[1]).toContain(challengeText);

    expect(f.decomposition.status).toBe("converged");
    expect(f.decomposition.iterations).toBe(2);
  });
});
