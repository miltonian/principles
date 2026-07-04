# Research pilot: bare model vs. Principles-compiled teams

**Result: the bare model won. Mean rubric compliance 0.669 vs 0.580 (Δ −0.089, n=10, not statistically significant — but no evidence of improvement, and three tasks show the framework can badly hurt output quality).** This page documents the loss, the autopsy, and what it falsified. We fixed the sample, the arms, and the decision rule before any result existed; this number ships because that's the deal.

## Setup

- **Arena:** [ResearchRubrics](https://github.com/scaleapi/researchrubrics) (Scale AI, ICLR 2026) — 10 tasks sampled from its 101 by seeded PRNG (seed `20260703`, manifest committed before any response existed). 21–34 expert-written weighted rubrics per task.
- **Arms, same model (claude-opus-4-8), same web access:**
  - `bare` — one call: the task prompt + "Respond with a comprehensive research report in Markdown," web tools on.
  - `principles` — `generate-agents` compiles a team per task (typed truths → adversarial vetting → cited decomposition → agents), runtime executes it with judged web gating.
- **Grading:** Scale's own grader, config-level changes only (GA Gemini 2.5 Pro snapshot, direct API). One Gemini call per rubric, binary Satisfied/Not; score = Σ(weight×satisfied)/Σ(positive weights) — their formula, their prompts. A Gemini judge scoring Claude systems: no home-team bias available.
- Per-rubric verdicts: [`grading/`](grading/). Responses: [`responses/`](responses/). Run logs with word counts + honesty flags: `run-log-*.jsonl`.

## Scores (their grader, their formula)

| task | bare | principles | Δ | principles word count (bare) |
|---|---|---|---|---|
| 605391 | 0.682 | **0.835** | +0.153 | 5,109 (2,428) |
| 6054a5 | 0.544 | **0.684** | +0.140 | 3,644 (1,914) |
| 6053d8 | 0.500 | **0.540** | +0.040 | 2,232 (1,769) |
| 605469 | 0.415 | **0.439** | +0.024 | 2,965 (2,949) |
| 9af315 | 0.818 | **0.833** | +0.015 | 11,480 (4,684) |
| 6053ce | **0.670** | 0.651 | −0.019 | 4,946 (3,857) |
| 605348 | **0.629** | 0.435 | −0.194 | **237** (2,349) |
| 60543d | **0.891** | 0.600 | −0.291 | 2,544 (1,697) |
| 605440 | **0.698** | 0.326 | −0.372 | **1,020** (2,961) |
| 6053ca | **0.847** | 0.458 | −0.389 | 1,326 (2,686) |
| **mean** | **0.669** | 0.580 | **−0.089** | |

Context (published binary-mode baselines from the benchmark's paper — different systems, different dates, not head-to-head): Gemini Deep Research 0.615, OpenAI DR 0.597, Perplexity DR 0.487. The bare Opus arm (0.669) — a single prompt with web tools — outscores all of them; treat that comparison loosely (their runs predate this model).

## Autopsy: the losses are mechanical, not mysterious

The five wins are moderate; three of the five losses are catastrophic, and each has a visible cause in the shipped artifacts:

1. **Verdict bias** (`605440`, 0.326): asked for a research report, the compiled team produced a 1,020-word *adjudication* ("Verdict: FALSE — provably so"). The pipeline's evaluation heritage framed the goal as claim-judging; expert rubrics wanted comprehensive coverage. First line of [the response](responses/principles/6847465956a0f6376a605440.md) says it all.
2. **Fourth-wall leakage + honesty tax** (`6053ca`, 0.458): the synthesis opens with "I'm the synthesis agent; the blackboard already contains…" — internal role narration shipped in the deliverable — then leads with verification caveats (7 agents unverified) before content. Honesty flags are the right mechanism; putting them ahead of the deliverable is a rendering bug.
3. **Synthesis collapse** (`605348`, 0.435): with 3 agents unverified, synthesis emitted a 237-word stub instead of a report.

The wins falsify "multi-agent is inherently worse here": +0.153 came with 5,109 words and four honestly-flagged agents. The machinery wins when synthesis writes a full report; it loses when the last mile — synthesis discipline — fails. Coverage, not eloquence, moves this metric (visible in the word-count column both ways).

## What this falsifies, and what it doesn't

- **Falsified:** "compiling a thinking system reliably improves report quality over the bare frontier model" — not at n=10, not with this synthesis stage.
- **Not tested here:** the framework's verification claims (audit trails, evidence-cited judging, honesty flags — this arena doesn't score them), and nothing about the fixed-last-mile version.
- Caveats: n=10, single seed, one model, one arena; compliance correlates mildly with length (r≈0.25 per the benchmark authors); the 4 early-graded reports' verdicts were cached and reused unchanged.

## Reproduce

```bash
yarn research-pilot fetch          # manifest (seeded)
yarn research-pilot run --arm bare --yes && yarn research-pilot run --arm principles --yes
# grading: clone scaleapi/researchrubrics, GEMINI_API_KEY in .env, see .bench-cache/grader/grade_arm.py
```

Generated 2026-07-03/04. Model calls ran on subscription credentials; grading cost ≈ $9 of Gemini 2.5 Pro.
