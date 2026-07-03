# Example: lease reviewer (ground-truth scored)

A generated evaluation team for the goal:

> *review a residential lease for terms unfavorable to the tenant, citing the specific clause for every concern*

Generated and run 2026-07-03. This example exists to answer the obvious skeptical question about generated evaluators: **does the output actually find real problems, or does it just sound thorough?** So the test case has an answer key.

## The setup

[`sample-lease.md`](sample-lease.md) is an authored lease with **seven deliberately planted tenant-hostile clauses** (listed in its header): the §3(b) renewal trap, §5 all-repairs-on-tenant, §7 no-notice entry, §9(a) deposit forfeiture, §11 unilateral rent increases, §12 jury-waiver + landlord-controlled arbitration, and §14 outcome-blind fee shifting. The evaluator was given **only the lease body** — the answer-key header was stripped before the run (see the prompt note in [`run-sample-lease.md`](run-sample-lease.md)).

## The score: 7/7 planted clauses found — plus finds we didn't plant

Every planted clause appears in the output with the clause cited and the mechanism of harm explained. Beyond the answer key, the run surfaced legitimate findings the authors didn't plan:

- **§6 quiet enjoyment hollowed** — "subject to the terms herein" subordinates the covenant to the §7 entry right (subtle, and correct)
- **Omission findings**: no habitability baseline, no duty to mitigate after §9(a) forfeiture, no itemized deposit accounting — notable because the skeptic *defended this category during generation*, rejecting a candidate truth that would have made clause-citation mandatory precisely because omissions have no clause to cite (see `generation-report.md`)
- **§1's missing commencement year**, correctly connected to the §3(b) notice window becoming incomputable
- It even flagged the ellipsis in §12's arbitration text as possibly-truncated source material — which is true; the sample was written that way

One honest caveat the run itself makes: it deliberately separates "unfavorable to the tenant" from "legally unenforceable," refusing the jurisdiction question — a distinction that also traces to a rejected truth in `generation-report.md`.

## What's here

| file | what it is |
|---|---|
| `ontology.json` | the compiled team — note **zero** subtasks requested web access: the gating mechanism declined tools for a task that needs none |
| `generation-report.md` | verbatim console: assumptions + four rejected truths (including the omission-findings defense and the jurisdiction-smuggling counterexample) |
| `sample-lease.md` | the test case with its answer key in the header |
| `run-sample-lease.md` | the unedited run output |

## Reproduce

```bash
yarn generate-agents "review a residential lease for terms unfavorable to the tenant, citing the specific clause for every concern"
cd packages/agent-package-<ts> && npm install && npm run run-agents "Review this lease: <lease text>"
```
