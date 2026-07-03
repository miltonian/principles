---
name: live-verification
description: Use when running or debugging the live pipeline (yarn generate-agents or a generated package's run-agents) — especially when a run seems hung, silent, slow, exits with structured-output or max-turns errors, or you need to see which pipeline stage a run is in.
---

# Live Pipeline Verification

## Overview

The pipeline makes ~15–40 sequential Opus 4.8 calls through the Claude Agent SDK (each spawns a CLI subprocess). It prints nothing between startup and the final report, so a healthy run under a degraded API looks identical to a hung one from stdout alone. This skill is how to run it observably and diagnose the known live failure modes.

## Launching a run

Never pipe through `tail`/`head` (buffers everything; you fly blind). Log to a file, enable the SDK stream watchdog so hung calls fail fast into the gateway's retry:

```bash
CLAUDE_ENABLE_STREAM_WATCHDOG=1 CLAUDE_STREAM_IDLE_TIMEOUT_MS=120000 \
  node dist/scripts/agentGenerator.js "<goal>" > gen.log 2>&1 &
```

Expected wall-clock: ~5 min healthy, 30+ min under API degradation. Cost: one derive + one skeptic call per truth + 1–5 (decompose+judge) pairs + one spec call per subtask, ×(up to 3 gateway retries each).

## Stage probe: where is a silent run?

Each SDK call writes a session transcript under `~/.claude/projects/<cwd-slug>/*.jsonl`. Classify transcripts newer than the run's log file by their stage-distinctive prompt text:

| grep for | stage |
|---|---|
| `Derive the typed fundamental truths` | derive_truths (1st) |
| `Claim under attack` | skeptic (one per truth) |
| `cite these ids in servesTruths` | decomposition |
| `return one verdict per criterion` | judge |
| `This agent's subtask` | agent_spec (last LLM stage) |

Counts tell you the stage and the retry rate. A live `claude` child process under the generator pid (`pgrep -P <pid>`) = a call in flight; no child for minutes = investigate.

## Known live failure modes (all hit in production)

| Symptom | Cause | Status/fix |
|---|---|---|
| `success but no structured_output ... outputFormat was likely ignored` | `$schema` meta-key in the JSON schema — CLI silently skips structured output | Gateway strips it (`claudeGateway.ts`); if reintroduced via a new schema path, strip there too |
| Same message, intermittent | CLI finalize-step flake (subprocess sometimes exits 1) | Gateway retries whole query, `MAX_ATTEMPTS = 3` |
| `error_max_turns ("Reached maximum number of turns")` | Long generation needed more turns; successful calls routinely use 2 | `MAX_TURNS = 4` in the gateway; if hit at 4, the error names the schema — raise the constant, don't loop |
| Run hangs 30+ min, no output | API degradation + internal SDK backoff, invisible because of output buffering | Watchdog env vars above + log-to-file; check stage probe before killing |
| `claude-opus-4-8 temporarily unavailable` | Platform-side | Wait; the gateway/SDK retries ride it out |

## Verifying a run's output

1. `packages/agent-package-*/src/ontology.json`: every subtask's `servesTruths` non-empty; assumptions listed (they print as "Proceeding on these ASSUMPTIONS"); rejected truths should come with real counterarguments.
2. Escape hatch: run the package with an off-domain prompt ("Write me a haiku") → expect a direct answer, not the agent pipeline.
3. In-frame prompt → expect `[agents run: ...]`, a synthesized answer, and a `[caution]` line if any agent output never passed the rubric (`RunResult.unverified`).
