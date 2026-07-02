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
});
