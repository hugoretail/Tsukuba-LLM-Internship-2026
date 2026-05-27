from __future__ import annotations

import argparse
import csv
import json
import time
from urllib.parse import urljoin
from pathlib import Path
from typing import Dict, List

import requests

from metrics import (
    compute_metrics,
    grammar_language_ok,
    keyword_coverage,
    list_language_ok,
    ui_language_ok,
)


def resolve_dataset_path(raw_path: str) -> Path:
    candidate = Path(raw_path)
    if candidate.exists():
        return candidate

    script_dir = Path(__file__).resolve().parent
    candidate = script_dir / raw_path
    if candidate.exists():
        return candidate

    candidate = script_dir / "data" / raw_path
    if candidate.exists():
        return candidate

    candidate = script_dir / "data" / Path(raw_path).name
    if candidate.exists():
        return candidate

    raise FileNotFoundError(f"Dataset not found: {raw_path}")


def load_dataset(path: Path) -> List[Dict[str, str]]:
    rows = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def check_health(base_url: str, connect_timeout: float, read_timeout: float) -> None:
    health_url = urljoin(base_url.rstrip("/") + "/", "api/health")
    response = requests.get(health_url, timeout=(connect_timeout, read_timeout))
    response.raise_for_status()


def call_translate(
    base_url: str,
    payload: Dict[str, object],
    connect_timeout: float,
    read_timeout: float,
    retries: int,
    backoff: float,
    timeout_multiplier: float,
) -> Dict[str, object]:
    last_error: Exception | None = None
    effective_read_timeout = read_timeout
    for attempt in range(retries + 1):
        try:
            response = requests.post(
                f"{base_url.rstrip('/')}/api/translate",
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=(connect_timeout, effective_read_timeout),
            )
            response.raise_for_status()
            return response.json()
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
            last_error = exc
            if attempt >= retries:
                raise
            effective_read_timeout = max(effective_read_timeout * timeout_multiplier, effective_read_timeout)
            time.sleep(backoff * (attempt + 1))

    if last_error:
        raise last_error
    raise RuntimeError("Unexpected error in call_translate")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:3000")
    parser.add_argument("--dataset", default="evaluation/data/llm_eval_v1.jsonl")
    parser.add_argument("--out", default="evaluation/output/results.csv")
    parser.add_argument("--model-label", default="qwen2.5-unknown")
    parser.add_argument("--timeout", type=float, default=600.0)
    parser.add_argument("--connect-timeout", type=float, default=10.0)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--retry-backoff", type=float, default=1.5)
    parser.add_argument("--timeout-multiplier", type=float, default=1.5)
    parser.add_argument("--skip-health-check", action="store_true")
    parser.add_argument("--continue-on-error", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--ui-lang", default="fr", choices=["fr", "ja"])
    parser.add_argument("--use-pivot-english", action="store_true")
    args = parser.parse_args()

    dataset_path = resolve_dataset_path(args.dataset)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if not args.skip_health_check:
        try:
            check_health(args.base_url, args.connect_timeout, 5.0)
        except Exception as exc:
            raise SystemExit(f"Health check failed. Is the app running? {exc}")

    rows = load_dataset(dataset_path)

    sources = []
    hyps = []
    refs = []
    directions = []
    per_sample = []

    for row in rows:
        payload = {
            "text": row["source"],
            "direction": row["direction"],
            "uiLang": args.ui_lang,
            "usePivotEnglish": bool(args.use_pivot_english),
        }
        started = time.time()
        error_message = ""
        try:
            result = call_translate(
                args.base_url,
                payload,
                args.connect_timeout,
                args.timeout,
                args.retries,
                args.retry_backoff,
                args.timeout_multiplier,
            )
        except requests.exceptions.RequestException as exc:
            if not args.continue_on_error:
                raise
            error_message = f"{type(exc).__name__}: {exc}"
            result = {"output": {"translation": "", "explanation": "", "hints": [], "grammar": []}}
        elapsed = (time.time() - started) * 1000.0

        output_raw = result.get("output")
        output = output_raw if isinstance(output_raw, dict) else {}
        translation = str(output.get("translation", ""))
        explanation = str(output.get("explanation", ""))
        hints = [str(item) for item in output.get("hints", [])]
        grammar = output.get("grammar", [])
        sources.append(row["source"])
        hyps.append(translation)
        refs.append(row["reference"])
        directions.append(row["direction"])

        expected_key = f"expected_keywords_{args.ui_lang}"
        expected_keywords = row.get(expected_key, []) if isinstance(row, dict) else []
        combined_support_text = " ".join([explanation, *hints] + [
            f"{g.get('name', '')} {g.get('explanation', '')}" for g in grammar
        ])
        coverage = keyword_coverage(combined_support_text, expected_keywords)

        explanation_nonempty = bool(explanation.strip())
        explanation_lang_ok = ui_language_ok(explanation, args.ui_lang)
        hints_nonempty = sum(1 for h in hints if h.strip())
        hints_lang_ok = list_language_ok(hints, args.ui_lang)
        grammar_count = len(grammar)
        grammar_lang_ok = grammar_language_ok(grammar, args.ui_lang)
        support_ok = (
            explanation_nonempty
            and hints_nonempty > 0
            and grammar_count > 0
            and explanation_lang_ok
            and hints_lang_ok
            and grammar_lang_ok
        )

        meta_raw = result.get("meta")
        meta = meta_raw if isinstance(meta_raw, dict) else {}

        per_sample.append(
            {
                "id": row["id"],
                "direction": row["direction"],
                "source": row["source"],
                "reference": row["reference"],
                "hypothesis": translation,
                "latency_ms": float(meta.get("latencyMs", elapsed)),
                "model_label": args.model_label,
                "use_pivot_english": bool(args.use_pivot_english),
                "request_error": error_message,
                "explanation": explanation,
                "explanation_nonempty": explanation_nonempty,
                "explanation_language_ok": explanation_lang_ok,
                "hints_count": len(hints),
                "hints_nonempty": hints_nonempty,
                "hints_language_ok": hints_lang_ok,
                "grammar_count": grammar_count,
                "grammar_language_ok": grammar_lang_ok,
                "support_ok": support_ok,
                "expected_keyword_coverage": coverage,
            }
        )

        time.sleep(args.sleep)

    sample_metrics, summary = compute_metrics(sources, hyps, refs, directions)

    with out_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "id",
                "direction",
                "model_label",
                "use_pivot_english",
                "latency_ms",
                "request_error",
                "source",
                "reference",
                "hypothesis",
                "explanation",
                "explanation_nonempty",
                "explanation_language_ok",
                "hints_count",
                "hints_nonempty",
                "hints_language_ok",
                "grammar_count",
                "grammar_language_ok",
                "support_ok",
                "expected_keyword_coverage",
                "bleu",
                "chrf",
                "rouge_l",
                "language_ok",
                "copied_source",
                "line_count_match",
                "length_ratio",
            ],
        )
        writer.writeheader()
        for row, metrics in zip(per_sample, sample_metrics):
            writer.writerow(
                {
                    **row,
                    "bleu": summary["bleu"],
                    "chrf": summary["chrf"],
                    "rouge_l": metrics.rouge_l,
                    "language_ok": metrics.language_ok,
                    "copied_source": metrics.copied_source,
                    "line_count_match": metrics.line_count_match,
                    "length_ratio": metrics.length_ratio,
                }
            )

    summary_path = out_path.with_suffix(".summary.json")
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} and {summary_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
