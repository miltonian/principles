# Live run (2026-07-03)

**Prompt:** A viral post claims 'science is broken — a famous paper PROVED most published research findings are false: https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.0020124'. Does the cited paper's rigor actually support that sweeping claim?

## Output (verbatim)

[agents run: agent-s1, agent-s2, agent-s3, agent-s4, agent-s5, agent-s6, agent-s7, agent-s8]

# Short answer: No. The paper's rigor does *not* support the viral claim — and it's the paper's rigor that most cleanly refutes it.

The cited paper is real, correctly identified, and (for what it is) methodologically sound. But the viral post misrepresents it on the two points that carry all its persuasive weight. Both things are true at once, so it helps to keep them on separate tracks.

---

## What the paper actually is

**John P. A. Ioannidis, "Why Most Published Research Findings Are False," *PLOS Medicine*, 2005** (DOI 10.1371/journal.pmed.0020124). The retrieval agent confirmed the full text — methods and results, not just an abstract — from the open-access source, so this verdict rests on adequate evidence, not a paywall stub.

Critically, it is a **theoretical probabilistic-modeling Essay**, not an empirical study. It collects **no new data** and never measures how many published findings are actually false. Instead it derives, from Bayes' theorem, the *positive predictive value* of a research finding:

> PPV = (1 − β)R / ((1 − β)R + α), with the explicit rule that a finding is "more likely true than false **if** (1 − β)R > α."

That "**if**" is the whole paper. Its conclusion is **conditional** on assumed inputs — pre-study odds (R), statistical power (1 − β), and researcher bias (u). The worked example (100,000 genetic polymorphisms, ~10 true associations → PPV ≈ 0.0012, falling to ~0.00015 with bias and competing teams) is an *illustration of the model*, not a measurement of the literature.

## Axis 1 — Is the paper rigorous? Yes, on its core (medium confidence)

Judged against the *correct* bar (modeling/simulation good-practice, ISPOR-SMDM + ADEMP — **not** the RCT/observational checklists, which would be a category error):

- **Correct derivation** — the PPV equation is a standard, valid Bayesian construction (verified from first principles: at α=0.05, power=0.80, PPV exceeds 50% only when pre-study odds beat ~1:16).
- **Transparent assumptions** — bias is *formally parameterized* (u), not hand-waved; R, power, and u are all explicitly defined.
- **Properly conditional conclusions** — the paper states its result as contingent, never as unconditional fact.

Confidence is capped at **medium** only because some material (the simulation internals, a formal sensitivity analysis, and a 2022 Correction e1004085) was outside the retrieved text and marked "not assessable" rather than scored. None of that touches the core.

## Axis 2 — Does the claim faithfully represent it? No (high confidence)

The claim's *one* faithful element is that "most published research findings are false" echoes the paper's own **title**. That title-match creates a strong illusion of fidelity — but the claim's actual force lives in two words the paper does not support:

- **"PROVED" → scope mismatch.** The paper offers a *conditional probability model*, not a deductive or empirical *proof*. Modeled likelihood under assumed parameters ≠ demonstrated fact about the real literature.
- **"Science is broken" → overgeneralization.** The model's operational domain is biomedical research (genetics, epidemiology, clinical trials). "Science" wholesale — physics, chemistry, etc. — is a leap the paper never makes, and "broken" is a totalizing verdict a single conditional model cannot license.

## Why the two axes point the same way (the key nuance)

These don't cancel — they **compound**. The rigor of the paper *is* its careful conditionality: "most findings false" is a *consequence of assuming low pre-study odds and bias*, not a proven property of published science. The viral post strips exactly that conditionality out. So the paper's methodological strength is precisely what convicts the claim: **a well-built conditional model cannot be cited as unconditional, universal, deductive proof.**

Per the standard logic that an unsupported claim isn't credible no matter how good its source, the credibility of the post is bounded by its weaker axis (fidelity) — and that failure sits on sufficient evidence, so the verdict is firm.

---

## Bottom line

**Don't rely on the post.** Ioannidis (2005) is a genuinely influential and rigorous *conditional model* showing that findings are *likely* to be false **under specific, common conditions** (small studies, small effects, many tested hypotheses, flexible analysis, financial interest, crowded/"hot" fields). That is a valuable and sobering point about *research design incentives*. It is **not** a proof that most science is false, and it is **not** a verdict that "science is broken." The paper's fame rests on a real argument; the viral post inflates it into two things — empirical *proof* and universal *breakage* — that the paper explicitly does not claim.

**What would change this:** Only re-scoping the claim to what the paper actually argues — e.g., *"a landmark paper argues most published biomedical findings are likely false under common low-prior, high-bias conditions"* — would make it defensible. No further evidence about the study is needed; the misrepresentation is in the epistemic verbs, not the figures.

*(One honesty note carried up from the pipeline: some specific PPV percentages that circulate about this paper's tables arrived as approximations, not verbatim, and a 2022 Correction exists whose contents weren't retrieved. Neither bears on this verdict, since the claim cites no specific numbers.)*

