# Research pilot: bare model vs. Principles-compiled teams — a four-version arc

**Final in-set result: v4 beats the bare model — mean 0.698 vs 0.653, winning 7 of 9 tasks.** It took four versions to get there, and the first one lost badly (0.552). Every version was rerun on the same locked tasks under the same referee; every fix was designed from the previous version's measured failure; the two v4 predictions were pre-registered in writing and resolved one-validated, one-falsified. This page documents all of it — the losses too, because we fixed the sample, the arms, and the decision rule before any result existed, and the numbers ship because that's the deal.

## Setup

- **Arena:** [ResearchRubrics](https://github.com/scaleapi/researchrubrics) (Scale AI, ICLR 2026) — 10 tasks sampled from its 101 by seeded PRNG (seed `20260703`, manifest committed before any response existed). 21–34 expert-written weighted rubrics per task.
- **Arms, same model (claude-opus-4-8), same web access:**
  - `bare` — one call: the task prompt + "Respond with a comprehensive research report in Markdown," web tools on.
  - `principles` — `generate-agents` compiles a team per task (survey-grounded typed truths → adversarial vetting → frame challenge → cited decomposition → agents), runtime executes it with judged web gating, render gates, and a specificity-retention gate.
- **Grading:** Scale's own grader, config-level changes only (GA Gemini 2.5 Pro snapshot, direct API). One Gemini call per rubric, binary Satisfied/Not; score = Σ(weight×satisfied)/Σ(positive weights) — their formula, their prompts. A Gemini judge scoring Claude systems: no home-team bias available.
- Per-version artifacts: `v1-*` … `v4-*` directories (responses, per-rubric grading, run logs with word counts + honesty flags). In-set bare arm: [`inset-responses-bare/`](inset-responses-bare/), [`inset-grading-bare/`](inset-grading-bare/).

## The four-version arc (official grades, 9 common tasks)

| task | bare | v1 | v2 | v3 | v4 |
|---|---|---|---|---|---|
| U-Net design (6053ca) | 0.847 | 0.458 | 0.819 | 0.875 | **0.958** |
| MCP guide (6054a5) | 0.544 | 0.684 | 0.684 | 0.658 | **0.722** |
| Business report (605391) | 0.682 | 0.835 | 0.800 | 0.800 | **0.835** |
| Alignment proof (605440) | 0.698 | 0.326 | 0.395 | 0.581 | **0.721** |
| Palantir brief (605348) | 0.629 | 0.435 | 0.790 | 0.710 | **0.710** |
| Haiti brief (6053d8) | 0.500 | 0.540 | 0.560 | 0.300 | **0.560** |
| Vitamin D (6053ce) | 0.670 | 0.651 | 0.745 | 0.708 | **0.708** |
| Automation essay (605469) | **0.415** | 0.439 | 0.451 | 0.463 | 0.415 |
| YouTube short (60543d) | **0.891** | 0.600 | 0.509 | 0.491 | 0.655 |
| **mean** | 0.653 | 0.552 | 0.639 | 0.621 | **0.698** |
| **wins vs bare** | — | 3/9 | 5/9 | 6/9 | **7/9** |

(The 10th task, a novel (9af315), completed v1–v3 but not v4 before we froze; its v1–v3 grades are in the version directories.)

What each version fixed, from the previous version's autopsy:

- **v1 → loss (0.552).** The teams reasoned well; the final synthesis step — the only unverified component in a framework whose thesis is "never ship unverified work" — kept fumbling the render: a courtroom verdict instead of a report, "I'm the synthesis agent…" shipped to the customer, a 237-word stub.
- **v2: synthesis contract (0.639, statistical tie).** Deliverable contract fixed before writing, mechanical render gates, synthesis gets its own judge + refine loop. Rendering disasters gone; remaining deficit concentrated in tasks whose *frame* was wrong before any agent ran.
- **v3: deliverable framing (0.621).** Artifact truths + breadth/coverage map. Modest; stage-attribution forensics on the transcripts then showed ~80% of all lost weight was decided at the truths step — the frame locked in from priors, and every downstream check verified coverage *of the wrong frame*.
- **v4: grounded framing (0.698, first win).** A web-grounded landscape survey *before* truth derivation (evidence in, authority out — the skeptic attacks the survey too); a frame-level skeptic licensed to say "you're solving the wrong problem"; a specificity-retention gate (names/figures/sources must survive to the deliverable or be listed as conscious omissions); o-grounded reworded to reward attribution rather than omission.

## Pre-registered predictions (written before the v4 rerun)

- **P1 — YouTube ≥ 0.70: MISSED** (0.655, up from 0.491). Survey-grounded genre awareness helps and is not sufficient for creator-packaging tasks. Falsified, on the record.
- **P2 — alignment ≥ 0.64: MET** (0.721, up from 0.395 in v2). The frame skeptic was designed for exactly this failure; it worked.
- **P3 — no v3 win regresses >0.05 vs bare: MET** (automation slipped to exactly parity, −0.048 vs its v3 score but not >0.05 below bare).
- **P4 — held-out generalization: IN PROGRESS** (below).

## Held-out check (overfitting control) — partial, in progress

Four iterations on the same ten tasks could overfit to those tasks. P4 requires the result to replicate on ten fresh tasks (seed `20260705`, disjoint by construction). Status when this page froze: all 10 bare responses done; 3 principles(v4) pairs officially graded — **one win (+0.104), one exact tie (0.907), one narrow loss (−0.031)**; v4 mean slightly ahead on n=3. The run was repeatedly interrupted by subscription usage limits; the complete held-out table ships in a follow-up. Partial artifacts: [`responses/`](responses/), [`grading/heldout-bare/`](grading/heldout-bare/), [`grading/heldout-principles/`](grading/heldout-principles/).

## Execution-model experiment — preliminary

Because generation (compilation) and execution are separate phases, `--exec-model` runs the execution phase on a smaller model against the *identical cached ontology*. Early findings (partial, honest):

- **Haiku 4.5 execution:** quality collapsed on the one completed task (pre-graded ~0.36 vs bare 0.625 on the same task — breadth loss plus factual errors Opus doesn't make), and the SDK's structured-output finalize step proved markedly more fragile on judge-verdict payloads. The compiled ontology organizes a small model; it does not make it know things.
- **Sonnet 5 execution:** never completed a task before we paused for usage limits, but immediately exposed two Opus-calibrated constants in our own gateway (tool-less and web turn caps — Sonnet chunks long generations across more turns). Both fixed and regression-tested.
- Takeaway so far: *the intelligence does not simply transplant.* Execution models differ in quality, reliability, and even which infrastructure assumptions they violate.

## What this falsifies, and what it doesn't

- **Falsified (v1):** "compiling a thinking system reliably improves report quality over the bare frontier model" — not without a verified last mile.
- **Falsified (P1):** "survey grounding closes creative-packaging gaps."
- **Supported (in-set):** frame-level grounding + frame skepticism + retention gates produce a measurable win over the bare model on documented-convention tasks (engineering, technical guides, structured briefs), with the residual losses concentrated in breadth-checklist and register/taste genres — some of which are the deliberate price of refusing to fabricate.
- **Open:** P4 (held-out generalization), the full execution-model question.
- Caveats: n=9–10, single seed each, one model family, one arena; compliance correlates mildly with length (r≈0.25 per the benchmark authors).

## Reproduce

```bash
yarn research-pilot fetch                        # in-set manifest (seeded)
yarn research-pilot fetch --held-out             # held-out manifest (disjoint, seeded)
yarn research-pilot run --arm bare --yes
yarn research-pilot run --arm principles --yes
yarn research-pilot run --arm principles --exec-model sonnet --yes   # execution-model experiment
# grading: clone scaleapi/researchrubrics, GEMINI_API_KEY in .env, run the committed driver: grade_arm.py
```

Generated 2026-07-03 → 2026-07-06. Model calls ran on subscription credentials; grading cost ≈ $25 of Gemini 2.5 Pro across all versions.
