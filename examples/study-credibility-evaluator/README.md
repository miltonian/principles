# Example: study-credibility evaluator (web-enabled)

A generated evaluation team for the goal:

> *evaluate whether a claim backed by data is based on a sufficiently rigorous study, fetching the study itself when a link or citation is provided*

Generated 2026-07-03 by `yarn generate-agents` (Claude Opus 4.8 via the Claude Agent SDK). Everything in this directory is a real artifact from that run — nothing is hand-edited.

## What's here

| file | what it is |
|---|---|
| `ontology.json` | the compiled team: vetted truths, subtasks with citations, agent specs, output rubric |
| `generation-report.md` | verbatim console output — the surfaced assumptions and the skeptic's five rejected truths with counterexamples |
| `run-ioannidis.md` | a real run against a viral claim citing the Ioannidis 2005 PLOS paper, which agent-s2 genuinely fetched |

## Tracing one criterion end to end

This is the audit trail most AI systems can't produce. Follow truth **t3**:

1. **Truth (vetted):** `t3 [fact]` — the objective contains two separable judgments: (a) is the study rigorous, and (b) does it support the claim. (It survived an adversarial skeptic pass; five sibling candidates didn't — see `generation-report.md` for their counterexamples, including why "rigor" is a two-place relation between study and claim.)
2. **Subtasks citing it:** `s1` (extract the exact claim), `s7` (claim-fidelity check, explicitly *independent of rigor*), `s8` (synthesis of the two verdicts). The citations are in `ontology.json` under `servesTruths` — checked mechanically at generation time: a truth no subtask serves fails compilation.
3. **Agents:** `agent-s7`'s instructions in `ontology.json` operationalize the fidelity check.
4. **Judged output:** in `run-ioannidis.md`, the answer's two-axis structure ("Axis 1 — Is the paper rigorous? / Axis 2 — Does the claim faithfully represent it?") is t3 made visible, and its verdict turns on exactly that separation: a rigorous conditional model, misrepresented by the claim's epistemic verbs.

## The web-gating mechanism

Only 2 of 8 subtasks carry `needsWeb: true` (`s2` fetch the study, `s5` retrieve design-appropriate methodological standards) — each with a concrete justification the decomposition judge verified (`d-web` criterion). At runtime only those two agents get `WebSearch`/`WebFetch`; the other six run tool-less. In the recorded run, transcript audit confirmed exactly those two agents used web tools.

## Reproduce / adapt

```bash
yarn generate-agents "<your goal>"          # ~15–40 Opus calls, minutes; see .claude/skills/live-verification
cd packages/agent-package-<ts> && npm install && npm run run-agents "<case>"
```

Outputs are model-generated and dated; regenerating will produce a same-shaped but not identical team.
