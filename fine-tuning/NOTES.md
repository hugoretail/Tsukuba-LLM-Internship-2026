# Fine-tuning study (FR <-> JA assistant)

## 1) Project context

Project: a FR <-> JA assistant built on a local LLM stack (Ollama) with
structured output (translation, explanation, hints, grammar). Local evaluation
on 50 examples (25 FR->JA, 25 JA->FR).

Current average results (llm_eval_v1 dataset):

| Variant | BLEU | chrF | ROUGE-L |
| --- | ---: | ---: | ---: |
| qwen2.5-1.5b | 8.94 | 37.15 | 0.4148 |
| qwen2.5-1.5b-pivot | 12.93 | 34.53 | 0.4055 |
| qwen2.5-7b | 8.80 | 4.35 | 0.3912 |
| qwen2.5-7b-pivot | 11.81 | 34.90 | 0.4177 |

Quick reading:
- 1.5b is stable; 7b without pivot is very poor on chrF.
- Pivot helps mainly on 7b, but it costs more latency.

## 2) What fine-tuning is

Fine-tuning means training a pre-trained model on your own data so that it learns
a style, a format, or a domain. The two main families are:

- Full fine-tuning: all model weights are updated. This usually requires a lot of time and resources.
- PEFT (LoRA, QLoRA): only small adapters are trained, which strongly reduces compute and memory costs.

Note on PEFT:
- LoRA adds low-rank matrices, reduces the number of trainable parameters and memory usage, and does not add inference latency.
- QLoRA combines 4-bit quantization and LoRA to fine-tune large models with limited VRAM.

## 3) Is it useful for our project?

It could be useful if we want to:
- stabilize the structured output (JSON format, sections, language used for explanations)
- adapt the style (pedagogical, simple, consistent)
- handle repeated translation choices better (e.g. particles, politeness)

However:
- our current dataset (50 sentences) is too small for a meaningful general quality gain; there is a risk of overfitting.
- the main bottleneck is translation quality itself, not only the output format.

Realistic short-term conclusion: fine-tuning is possible, but it is not worth it without much more high-quality data.

## 4) What would we need?

Data:
- ideally several thousand high-quality FR<->JA pairs
- consistent annotations for explanation/hints/grammar if we want to stabilize them
- cleaning: no mistakes, no mismatches, consistent style

Hardware:
- a GPU is recommended. PEFT (LoRA/QLoRA) helps avoid full fine-tuning.
- typical tools: LLaMA-Factory or Axolotl (CLI and YAML configs).

Time (rough estimate, depends on GPU and dataset size):
- small SFT LoRA run (a few thousand examples): a few hours to 1 day
- larger dataset: several days
These are order-of-magnitude estimates, not guarantees.

## 5) Plan

1) Define the goal
	- cleaner format? better translation? better explanation?

2) Build the dataset
	- FR/JA pairs + expected outputs (if we also want to train the explanation)
	- split into train/valid/test

3) Choose the method
	- LoRA or QLoRA (rather than full fine-tuning)

4) Train with a tool (e.g. LLaMA-Factory or Axolotl)
	- YAML config
	- choose the base model (Qwen2.5-1.5b or 7b)

5) Evaluate with our pipeline
	- same test dataset, same graphs
	- compare BLEU / chrF / ROUGE-L and support_ok

6) Integrate into the app
	- export the adapter or merge the model
	- verify that inference works with the runtime (Ollama or another stack)

## 6) Answer to the question: is it worth it?

Short term (with 50 examples): no, the gain would likely be small and unstable.

If we still want to test it:
- start with LoRA on 1.5b
- run a small experiment (a few hundred to 1-2k examples)
- measure whether we gain chrF and explanation stability

If we want a real quality gain:
- we need a much larger and cleaner dataset
- or we need to switch to a base model that is more translation-oriented

## 7) Sources

- LoRA paper: https://arxiv.org/abs/2106.09685
- QLoRA paper: https://arxiv.org/abs/2305.14314
- PEFT (LoRA, adapters): https://github.com/huggingface/peft
- LLaMA-Factory (fine-tuning CLI, LoRA/QLoRA, requirements): https://github.com/hiyouga/LLaMA-Factory
- Axolotl (fine-tuning toolkit, LoRA/QLoRA): https://github.com/axolotl-ai-cloud/axolotl
