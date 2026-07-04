#!/usr/bin/env python3
"""Config-level driver for Scale's ResearchRubrics grader.

Identical to src/evaluate_rubrics/evaluate_task_rubrics except the
RubricEvaluator constructor args: direct Gemini (GA model) via LiteLLM's
gemini/ provider with GEMINI_API_KEY, instead of Scale's internal
litellm_proxy route and a retired preview snapshot. Prompts, evaluation
logic, and the compliance formula are theirs, untouched.

Usage: .venv/bin/python grade_arm.py <responses_dir> <out_dir> [sample_id ...]
"""
import asyncio, json, os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src" / "evaluate_rubrics"))
from evaluate_single_report import RubricEvaluator  # noqa: E402

BASE = Path(__file__).parent
DATA = BASE / "data" / "researchrubrics" / "processed_data.jsonl"
MODEL = "gemini/gemini-2.5-pro"


def load_rubrics_by_id():
    by_id = {}
    with open(DATA) as f:
        for line in f:
            row = json.loads(line)
            by_id[row["sample_id"]] = row["rubrics"]
    return by_id


def compliance(rows):
    # Their formula verbatim (src/calculate_metrics/calculate_compliance_score.py):
    # sum(score*weight) / sum(weights > 0)
    num = sum(r["score"] * r["weight"] for r in rows)
    den = sum(r["weight"] for r in rows if r["weight"] > 0)
    return num / den if den else 0.0


async def main():
    responses_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    only = set(sys.argv[3:])
    out_dir.mkdir(parents=True, exist_ok=True)
    rubrics_by_id = load_rubrics_by_id()

    evaluator = RubricEvaluator(
        api_key=os.environ["GEMINI_API_KEY"],
        model=MODEL,
        max_concurrent=4,  # polite to free-tier rate limits
    )
    # Config-level: their capacity/pricing tables are keyed only by the internal
    # proxy model name; register the GA model (same 2.5 Pro family, same window).
    evaluator.token_limits[MODEL] = 200000
    evaluator.pricing[MODEL] = {"input": 1.25, "output": 10.0}

    summary = []
    for md in sorted(responses_dir.glob("*.md")):
        sid = md.stem
        if only and sid not in only:
            continue
        out_file = out_dir / f"{sid}.jsonl"
        if out_file.exists():
            rows = [json.loads(l) for l in out_file.read_text().splitlines() if l.strip()]
            summary.append((sid, compliance(rows), len(rows), "cached"))
            continue
        rubrics = rubrics_by_id[sid]
        df = await evaluator.evaluate_all_rubrics(
            rubrics=rubrics, pdf_paths={sid: md}, save_results=False
        )
        rows = df.to_dict("records")
        real = [r for r in rows if str(r.get("verdict", "")).lower() != "error" and r.get("score") is not None]
        if not real:
            print(f"  {sid}: ALL verdicts errored — not caching (fix quota/billing and rerun)", flush=True)
            continue
        with open(out_file, "w") as f:
            for r in rows:
                f.write(json.dumps({k: r.get(k) for k in ("rubric_title", "verdict", "weight", "score", "confidence", "reasoning")}, default=str) + "\n")
        summary.append((sid, compliance(rows), len(rows), "graded"))
        print(f"  {sid}: compliance={compliance(rows):.3f} over {len(rows)} rubrics", flush=True)

    print("== SUMMARY ==")
    for sid, score, n, how in summary:
        print(f"{sid}\t{score:.3f}\t{n} rubrics\t{how}")


if __name__ == "__main__":
    asyncio.run(main())
