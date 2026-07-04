import { describe, it, expect } from "vitest";
import { plan } from "../../src/runtime/planner";
import { Ontology } from "../../src/shared/types";
import { Llm } from "../../src/llm/gateway";

const ontology: Ontology = {
  objective: "obj",
  truths: [], assumptions: [], subtasks: [],
  agents: [
    { id: "agent-s1", name: "A", subtaskId: "s1", instructions: "", servesTruths: [], dependsOn: [], outputHint: "" },
    { id: "agent-s2", name: "B", subtaskId: "s2", instructions: "", servesTruths: [], dependsOn: ["agent-s1"], outputHint: "" },
    { id: "agent-s3", name: "C", subtaskId: "s3", instructions: "", servesTruths: [], dependsOn: [], outputHint: "" },
  ],
  outputRubric: [],
};

const fakeLlm = (response: unknown): Llm => (async () => response) as unknown as Llm;

describe("plan", () => {
  it("closes the selected set under dependencies", async () => {
    const llm = fakeLlm({ fits: true, reason: "matches", selectedAgentIds: ["agent-s2"] });
    const result = await plan(llm, ontology, "prompt");
    expect(result.fits).toBe(true);
    expect(result.agents.map((a) => a.id).sort()).toEqual(["agent-s1", "agent-s2"]);
  });

  it("drops unknown agent ids", async () => {
    const llm = fakeLlm({ fits: true, reason: "r", selectedAgentIds: ["agent-s3", "agent-ghost"] });
    const result = await plan(llm, ontology, "prompt");
    expect(result.agents.map((a) => a.id)).toEqual(["agent-s3"]);
  });

  it("reports a non-fitting frame", async () => {
    const llm = fakeLlm({ fits: false, reason: "prompt is off-domain", selectedAgentIds: [] });
    const result = await plan(llm, ontology, "prompt");
    expect(result.fits).toBe(false);
    expect(result.agents).toEqual([]);
  });

  it("passes deliverable genre/audience through and tolerates their absence", async () => {
    const withFields = await plan(fakeLlm({ fits: true, reason: "r", selectedAgentIds: ["agent-s1"], deliverableGenre: "design doc", deliverableAudience: "ML engineers" }), ontology, "p");
    expect(withFields.deliverableGenre).toBe("design doc");
    expect(withFields.deliverableAudience).toBe("ML engineers");
    const without = await plan(fakeLlm({ fits: true, reason: "r", selectedAgentIds: ["agent-s1"] }), ontology, "p");
    expect(without.deliverableGenre).toBeUndefined();
  });

  it("includes genre adoption instruction in system prompt", async () => {
    let capturedSystem: string | undefined;
    const llm = (async (req: any) => {
      capturedSystem = req.system;
      return { fits: true, reason: "matches", selectedAgentIds: ["agent-s1"] };
    }) as unknown as Llm;

    await plan(llm, ontology, "prompt");
    expect(capturedSystem).toContain("adopt that as the genre");
  });

  it("includes truths in prompt when ontology has truths", async () => {
    let capturedPrompt: string | undefined;
    const llm = (async (req: any) => {
      capturedPrompt = req.prompt;
      return { fits: true, reason: "matches", selectedAgentIds: ["agent-s1"] };
    }) as unknown as Llm;

    const ontologyWithTruths: Ontology = {
      objective: "obj",
      truths: [
        { id: "t1", type: "constraint", statement: "Deliverable is a video tutorial", rationale: "User specified format" },
        { id: "t2", type: "definition", statement: "Video tutorial: step-by-step visual guide", rationale: "Standard definition" },
      ],
      assumptions: [],
      subtasks: [],
      agents: ontology.agents,
      outputRubric: [],
    };

    await plan(llm, ontologyWithTruths, "prompt");
    expect(capturedPrompt).toContain("## Truths");
    expect(capturedPrompt).toMatch(/- t\d+ \[constraint\]: Deliverable is a video tutorial/);
    expect(capturedPrompt).toMatch(/- t\d+ \[definition\]: Video tutorial: step-by-step visual guide/);
  });
});
