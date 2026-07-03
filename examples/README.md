# Examples gallery

Three real, provenance-complete demonstrations of the Principles framework, generated 2026-07-03 with the current codebase (Claude Opus 4.8 via the Claude Agent SDK). Nothing here is mocked or hand-polished: generation reports are verbatim console output, run transcripts are unedited, and every README claim traces to an artifact in the same directory — including the misses.

| example | shows | live cost when generated |
|---|---|---|
| [`study-credibility-evaluator/`](study-credibility-evaluator/) | a web-enabled evaluation team; judge-verified web gating; a real run that fetched and analyzed an actual paper | ~35 calls to generate, ~20 to run |
| [`lease-reviewer/`](lease-reviewer/) | a text-only evaluation team run against a sample lease with planted hostile clauses — checked against known ground truth | ~30 calls to generate, ~15 to run |
| [`outcome-rubric-vendor-security/`](outcome-rubric-vendor-security/) | the `compile-rubric` product: a gradeable, meta-checked rubric for outcome-driven agents | ~20 calls |

## What to look for

Every example carries the framework's audit trail:

- **Typed truths that survived an adversarial skeptic** — and, more interestingly, the ones that *didn't*, each rejected with a concrete counterexample (`generation-report.md` files).
- **Assumptions surfaced, not smuggled** — "Proceeding on these ASSUMPTIONS (correct me if wrong)".
- **Subtasks that cite the truths they serve** (`servesTruths` in each `ontology.json`) — coverage is checked by code, not vibes.
- **Honesty in the output** — runs disclose unverified steps (`[caution]` lines) and truncated retrievals rather than papering over them.

## Regenerating

```bash
yarn generate-agents "<goal>"     # evaluation team → packages/agent-package-<ts>/
yarn compile-rubric "<goal>"      # rubric only → rubrics/<slug>-<ts>/
```

Both cost real model calls (minutes, not seconds) — read `.claude/skills/live-verification/` first. Outputs are model-generated and dated; regeneration produces same-shaped but not identical artifacts.
