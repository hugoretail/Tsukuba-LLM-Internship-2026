# Evaluation

This folder contains a lightweight evaluation pipeline for the FR <-> JA translation app.

## Why these metrics

Based on the references you shared, the most practical metrics for this project are:

- BLEU: standard MT baseline, cheap to compute, good for tracking regressions.
- chrF: character-level F-score, much more robust for Japanese than word BLEU.
- ROUGE-L: sequence overlap signal for structure/ordering.

The Zenn article gives a broad overview of common metrics (BLEU, METEOR, ROUGE-L, BERTScore, etc.).
The devneko link is about BARTScore. It is powerful but requires a heavy seq2seq model and is harder to run offline.
Given the internship constraints and local Ollama setup, BLEU + chrF + ROUGE-L are the most useful starting trio.

## Setup

1. Create a Python venv.
2. Install dependencies:

```
python -m pip install -r evaluation/requirements.txt
```

## Dataset format

JSONL in `evaluation/data/*.jsonl`:

```
{"id":"frja-001","direction":"fr-ja","source":"...","reference":"...","tags":["..."],"difficulty":"A1","expected_keywords_fr":["..."],"expected_keywords_ja":["..."]}
```

Add more items to improve coverage. Keyword lists are optional and used only for heuristic coverage.

Default dataset: `evaluation/data/llm_eval_v1.jsonl` (50 samples: 25 FR->JA + 25 JA->FR)

## Run evaluation

### Tutorial

Start the Next.js app with a model, then run the evaluator:

```
set OLLAMA_MODEL=qwen2.5:1.5b
npm run dev
```

In another terminal:

```
python evaluation/run_eval.py --dataset evaluation/data/llm_eval_v1.jsonl --model-label qwen2.5-1.5b
```

Repeat with the 7b model:

```
set OLLAMA_MODEL=qwen2.5:7b
npm run dev
python evaluation/run_eval.py --dataset evaluation/data/llm_eval_v1.jsonl --model-label qwen2.5-7b --out evaluation/output/results-7b.csv
```

You can also test the pivot option:

```
python evaluation/run_eval.py --model-label qwen2.5-1.5b-pivot --use-pivot-english
You should run both modes for each model to compare pivot vs non-pivot:

```
python evaluation/run_eval.py --dataset evaluation/data/llm_eval_v1.jsonl --model-label qwen2.5-7b --out evaluation/output/results-7b.csv
python evaluation/run_eval.py --dataset evaluation/data/llm_eval_v1.jsonl --model-label qwen2.5-7b --use-pivot-english --out evaluation/output/results-7b-pivot.csv
```
```

### Complete Pipeline

```
python evaluation/run_eval.py --dataset evaluation/data/llm_eval_v1.jsonl --model-label qwen2.5-1.5b --out evaluation/output/results-1p5b.csv
python evaluation/run_eval.py --dataset evaluation/data/llm_eval_v1.jsonl --model-label qwen2.5-1.5b --use-pivot-english --out evaluation/output/results-1p5b-pivot.csv
python evaluation/run_eval.py --dataset evaluation/data/llm_eval_v1.jsonl --model-label qwen2.5-7b --out evaluation/output/results-7b.csv
python evaluation/run_eval.py --dataset evaluation/data/llm_eval_v1.jsonl --model-label qwen2.5-7b --use-pivot-english --out evaluation/output/results-7b-pivot.csv
```

## Visualize

```
python evaluation/visualize.py --inputs evaluation/output/results.csv evaluation/output/results-7b.csv
```

This generates plots in `evaluation/output`.

## Outputs

- `results.csv`: per-sample metrics + latency + support heuristics
- `results.summary.json`: aggregate BLEU/chrF/ROUGE-L
- `metrics_bar.png`: average metric comparison
- `latency_box.png`: latency distribution
- `latency_vs_chrf.png`: latency vs quality
- `support_quality_bar.png`: explanation/hints/grammar success rates
- `keyword_coverage_box.png`: heuristic keyword coverage
