from __future__ import annotations

import argparse
from pathlib import Path
from typing import List

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns


def load_frames(paths: List[Path]) -> pd.DataFrame:
    frames = [pd.read_csv(path) for path in paths]
    return pd.concat(frames, ignore_index=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", nargs="+", required=True)
    parser.add_argument("--out-dir", default="evaluation/output")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = load_frames([Path(path) for path in args.inputs])

    sns.set_theme(style="whitegrid")

    if "use_pivot_english" in df.columns:
        df["model_variant"] = df["model_label"] + df["use_pivot_english"].map(
            {True: "-pivot", False: ""}
        )
        label_col = "model_variant"
    else:
        df["model_variant"] = df["model_label"]
        label_col = "model_label"

    metric_means = df.groupby(label_col)[["bleu", "chrf", "rouge_l"]].mean().reset_index()

    plt.figure(figsize=(8, 4))
    sns.barplot(
        data=metric_means.melt(id_vars=[label_col], var_name="metric", value_name="score"),
        x="metric",
        y="score",
        hue=label_col,
    )
    plt.title("Average Translation Metrics")
    plt.tight_layout()
    plt.savefig(out_dir / "metrics_bar.png", dpi=200)
    plt.close()

    plt.figure(figsize=(8, 4))
    sns.boxplot(data=df, x=label_col, y="latency_ms")
    plt.title("Latency Distribution")
    plt.tight_layout()
    plt.savefig(out_dir / "latency_box.png", dpi=200)
    plt.close()

    plt.figure(figsize=(8, 4))
    sns.scatterplot(data=df, x="latency_ms", y="chrf", hue=label_col)
    plt.title("Latency vs chrF")
    plt.tight_layout()
    plt.savefig(out_dir / "latency_vs_chrf.png", dpi=200)
    plt.close()

    support_cols = [
        "explanation_nonempty",
        "explanation_language_ok",
        "hints_nonempty",
        "hints_language_ok",
        "grammar_count",
        "grammar_language_ok",
        "support_ok",
    ]

    support_df = df.copy()
    support_df["grammar_nonempty"] = support_df["grammar_count"].fillna(0) > 0
    support_df["hints_nonempty"] = support_df["hints_nonempty"].fillna(0) > 0
    support_df["grammar_count"] = support_df["grammar_nonempty"]

    support_means = (
        support_df.groupby(label_col)[
            [
                "explanation_nonempty",
                "explanation_language_ok",
                "hints_nonempty",
                "hints_language_ok",
                "grammar_count",
                "grammar_language_ok",
                "support_ok",
            ]
        ]
        .mean()
        .reset_index()
    )

    plt.figure(figsize=(10, 4))
    melted = support_means.melt(id_vars=[label_col], var_name="metric", value_name="rate")
    sns.barplot(data=melted, x="metric", y="rate", hue=label_col)
    plt.title("Support Quality Rates")
    plt.ylim(0, 1)
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()
    plt.savefig(out_dir / "support_quality_bar.png", dpi=200)
    plt.close()

    if "expected_keyword_coverage" in df.columns:
        coverage = df.dropna(subset=["expected_keyword_coverage"])
        if not coverage.empty:
            plt.figure(figsize=(8, 4))
            sns.boxplot(data=coverage, x=label_col, y="expected_keyword_coverage")
            plt.title("Keyword Coverage (Heuristic)")
            plt.ylim(0, 1)
            plt.tight_layout()
            plt.savefig(out_dir / "keyword_coverage_box.png", dpi=200)
            plt.close()

    df.to_csv(out_dir / "combined_results.csv", index=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
