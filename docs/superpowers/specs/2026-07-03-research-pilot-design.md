# research-pilot — Design Spec

**Date:** 2026-07-03
**Status:** Approved by user (pilot before any competitor round)
**Builds on:** examples-gallery (`98028ac`); scouts in `.superpowers/sdd/scout-researchrubrics.md` + `scout-competitors.md`

## Purpose

The cheapest falsifiable test of the framework's headline question: **does compiling a thinking system from the goal beat just asking the model?** Two arms — bare Opus 4.8 (with web) vs. Principles-compiled teams — on 10 seeded ResearchRubrics tasks, graded by Scale's own Gemini-based grader, unmodified. Outcome gates the competitor round (CrewAI/LangGraph/AG2/DSPy) — that round's fairness apparatus is deliberately NOT built here.

## Arena (scout-verified)

- Dataset: HF `ScaleAI/researchrubrics` (MIT, no auth) — 101 prompts, expert rubrics `{criterion, weight −5..+10, axis}`, ~26/task.
- Grader: `scaleapi/researchrubrics` repo, standalone; one Gemini call per rubric, binary Satisfied/Not; score = Σ(weight×satisfied)/Σ(positive weights); interface = `agent_responses/<sample_id>.md` folders. We run it byte-unmodified except config (GA Gemini snapshot + key). Published bar: Gemini DR 0.615, OpenAI DR 0.597, Perplexity 0.487. No Claude-backbone numbers exist — ours are the first either way.
- Sample: 10 tasks, seeded mulberry32 (seed `20260703`), manifest checked in before any response exists.

## The two arms (both through the existing `Llm` gateway → subscription credentials; no new infra)

1. **`bare`** — one gateway call per task: the task prompt verbatim + a minimal uniform wrapper ("Respond with a comprehensive research report in Markdown."), `webTools: true`, plain string-output schema (`schemaName: "bench_report"`, additive). What "just ask Opus with web" produces.
2. **`principles`** — per task: full pipeline (`generateOntology`-equivalent core path) with the task prompt as the goal, then the runtime orchestrator in-process. In-process is faithful-by-construction: `src/runtime` is copied verbatim into emitted packages (invariant 3), so in-repo runtime ≡ shipped runtime. Web access flows through build 3's judged `needsWeb` gating — the system as shipped, no bench-special behavior.

Fairness notes recorded in the artifact: identical task prompt text to both arms; no length coaching beyond the bare arm's one-line wrapper; response word counts reported per arm (scout flagged length-compliance correlation r≈0.25); model pinned `claude-opus-4-8` both arms.

## Deliverables

```
src/bench/researchLoader.ts        # dataset fetch/parse, seeded sample, manifest (own mulberry32 copy — swe loader is parked on another branch)
src/bench/researchArms.ts          # runBareArm(llm, task), runPrinciplesArm(llm, task) → { sampleId, arm, markdown, callCount? }
src/scripts/researchPilot.ts       # yarn research-pilot fetch|run|status — resumable (skip existing response files), --limit, --yes cost guard
benchmarks/research-pilot/
  manifest.json                    # 10 sample_ids + seed, committed pre-run
  responses/bare/<sample_id>.md    # grader-ready folders
  responses/principles/<sample_id>.md
  grading/                         # their grader's outputs per arm (committed)
  README.md                        # scoreboard: their weighted score per arm/task, word counts, published baselines for context, pilot caveats (n=10, single seed)
```

Grading step is operator-run (needs user's `GEMINI_API_KEY`): clone their repo into `.bench-cache/`, point at each responses folder, capture outputs. Documented as exact commands in the README.

## Decision rule (fixed before results)

Clear Principles win (score gap beyond overlapping bootstrap CIs over tasks) → fund the competitor round. Wash or loss → stop, publish honestly, analyze why in the article. Either result ships.

## Testing

Network-free: loader parse/sample/manifest determinism; bare arm request shape (webTools true, prompt contains task verbatim); principles arm wiring (injected fake pipeline+runtime, response written from synthesis output); CLI resumability/cost-guard/exit codes — all with fakes, mirroring the swe-bench harness test patterns. Live: fetch+manifest commit; 1-task smoke both arms (read outputs by eye); full 10×2 background run; grader run; scoreboard.

## Out of scope

Competitor arms and their fairness apparatus (canonical templates, Tavily, Python envs); any grader modification; task counts beyond 10; leaderboard/press artifacts (that's after the gate).
