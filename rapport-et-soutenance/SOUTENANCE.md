# BUT3 Internship Defense Slide Content (English)

Replace placeholders before use: Hugo Retail, Natural Language Processing Lab, University of Tsukuba, Tsukuba, 1st April - 23rd June.

Total: 14 slides ~ 15 minutes.

---

## Slide 1 (1/14) - Title | Internship Defense
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 0/5 Intro | Slide 1/14
On-slide (keywords only):
- Internship defense
- NLP lab
- LLM translation App
- University of Tsukuba, Tsukuba
- 1st April - 23rd June
Visuals:
- Lab photo or neutral NLP image
Oral notes (what to say):
- One sentence on who you are and the internship context
- One sentence on the project topic and its goal

Text:
Hello everyone. My name is Hugo Retail, and I am presenting my BUT3 internship defense.

From the 1st of April to the 23rd of June, I worked at the Natural Language Processing Lab at the University of Tsukuba, in Tsukuba.

My main project was to build a French ↔ Japanese learning assistant based on a local Large Language Model. The idea is not only to output a translation, but also learner-friendly support like short explanations, hints, and grammar points.

## Slide 2 (2/14) - Agenda | Presentation Map
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 0/5 Intro | Slide 2/14
On-slide (keywords only):
- 1. Context and mission
- 2. Project scope
- 3. Technical work
- 4. Results and research
- 5. Wrap-up
Visuals:
- Simple numbered roadmap
Oral notes (what to say):
- Keep timing visible: about 1 minute per slide

Text:
Here is the roadmap for this talk.

First, I will introduce the context and my mission. Then I will present the scope of the project and the main workstreams.

After that, I will explain the technical implementation: the web app, the API, the structured output, and the evaluation pipeline.

Then I will show the results and discuss the main trade-offs, and finally I will conclude with next steps.

## Slide 3 (3/14) - Context | NLP Lab and Environment
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 1/5 Context | Slide 3/14
On-slide (keywords only):
- Natural Language Processing (NLP)
- Large Language Models (LLM)
- Research environment
- Stakeholders: supervisor, lab members
Visuals:
- Organization map or lab structure diagram
Oral notes (what to say):
- Where you fit in the lab and who you interacted with
- Why this topic matters for the lab

Text:
I worked in a research environment focused on Natural Language Processing, and more specifically on using Large Language Models for language-related tasks.

In the lab, I interacted with my supervisor and lab members to get feedback, validate assumptions, and align the project with realistic constraints.

This topic matters because LLMs can be useful for education, but they also have limitations: they can be slow, inconsistent, or hallucinate. So the challenge is to build something helpful and controllable, not just “a chatbot”.

## Slide 4 (4/14) - Mission | Goals and Constraints
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 1/5 Context | Slide 4/14
On-slide (keywords only):
- Goal: translation App for learners
- Scope: FR <-> JA
- Constraint: local models
- Success criteria: quality, support, latency
Visuals:
- Mission triangle: quality / support / latency
Oral notes (what to say):
- Explain for whom the tool is built and why the constraints exist

Text:
The mission was to build a translation tool for learners, not for professional translation.

So the output must include: a translation, a short explanation, a few hints, and some grammar points. The goal is to help the user understand “why” the translation looks like this.

Another important constraint is local-first inference: the model runs locally with Ollama, which is realistic for privacy and cost, but it also limits performance compared to large online models.

Finally, I evaluated the system with three success criteria: translation quality, pedagogical support quality, and latency.

NOTES (FR):
- Quality (qualite de traduction): fidelite du contenu et forme proche de la reference. Mesuree par BLEU, chrF, ROUGE-L, et des checks comme language_ok, copied_source, line_count_match, length_ratio.
- Support (aide pedagogique): qualite des explications et des hints pour l’apprenant. Mesuree par explanation_nonempty, explanation_language_ok, hints_nonempty, hints_language_ok, grammar_count, grammar_language_ok, support_ok, plus expected_keyword_coverage.
- Latency (temps de reponse): reactivite du systeme pour l’utilisateur. Mesuree par latency_ms, les erreurs request_error, et l’impact des retries/timeouts

## Slide 5 (5/14) - Project Scope | Workstreams
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 2/5 Scope | Slide 5/14
On-slide (keywords only):
- LangChain learning path
- Translation app: jisho-ultime
- Evaluation pipeline
- Fine-tuning study
Visuals:
- 4-block roadmap or timeline
Oral notes (what to say):
- One line per workstream, focus on purpose

Text:
The project is organized into four workstreams.

First, a LangChain learning path to understand core concepts like prompts, message roles, and structured outputs.

Second, the translation application itself, called “jisho-ultime”, built with Next.js and TypeScript.

Third, a lightweight evaluation pipeline in Python to measure quality, support, and latency on a small dataset.

And fourth, a short fine-tuning feasibility study, to decide if training the model is realistic with our data and constraints.

## Slide 6 (6/14) - System Overview | End-to-End Flow
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 2/5 Scope | Slide 6/14
On-slide (keywords only):
- User input
- Next.js API
- LLM inference
- Structured output: translation, explanation, hints, grammar
- Evaluation loop
Visuals:
- Pipeline diagram with arrows
- A Screenshot of the actual app
Oral notes (what to say):
- Explain the data flow and why structured output matters

Text:
End-to-end, the user enters a sentence or multiple lines in the web UI.

The Next.js backend exposes an API route, `/api/translate`, that calls the local LLM through Ollama. The model is instructed to return a strict JSON object with fixed fields.

This structured output is important because it makes the system testable and more reliable: the UI can render the translation, explanation, hints, and grammar separately, and the evaluator can automatically measure whether the support is present and in the correct language.

Then, the evaluation script repeatedly calls the API on a dataset and produces CSV files and plots for comparison.

## Slide 7 (7/14) - LangChain Learning | Concepts Acquired
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 2/5 Scope | Slide 7/14
On-slide (keywords only):
- Core concepts: prompts, chains, tools
- Output schemas
- Prompt engineering habits
Visuals:
- Concept map
Oral notes (what to say):
- Link the learning path to later implementation choices

Text:
The main concepts I applied from LangChain are: prompt structure with system and user messages, and schema-driven outputs.

In practice, I used a JSON schema to force the model to return structured content. This reduces UI parsing problems and makes it easier to validate outputs.

I also adopted prompt engineering habits that are useful for small models: keep tasks focused, reduce ambiguity, and add constraints like “keep the same line count” for multi-line inputs.

## Slide 8 (8/14) - Translation App | Jisho-Ultime
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 2/5 Scope | Slide 8/14
On-slide (keywords only):
- FR <-> JA interface
- Pivot English option
- Structured JSON output
- Tech stack: Next.js, TypeScript, Ollama
Visuals:
- UI screenshot or schema diagram
Oral notes (what to say):
- Focus on feature intent, not click-by-click UI

Text:
The app is designed for French ↔ Japanese learners.

The user chooses the direction (French to Japanese or Japanese to French) and the interface language for the explanations.

There is also an optional “pivot English” mode. In this mode, the system can translate through English and then generate explanations and grammar in English first, before translating those explanations into the UI language. This can make the analysis more stable for small models.

Technically, it is built with Next.js and TypeScript, and it runs a local model with Ollama.

## Slide 9 (9/14) - Evaluation Pipeline | Dataset and Metrics
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 2/5 Scope | Slide 9/14
On-slide (keywords only):
- Dataset: 50 items, FR <-> JA
- BLEU: Bilingual Evaluation Understudy
- chrF: character F-score
- ROUGE-L: Longest Common Subsequence
- Outputs: CSV, charts
Visuals:
- Pipeline diagram or metrics table
Oral notes (what to say):
- Plain-language meaning of each metric
- Why chrF helps for Japanese

Text:
To evaluate the system, I created a small dataset of 50 examples: 25 French → Japanese and 25 Japanese → French.

The evaluator calls the `/api/translate` endpoint for each item, records the translation and support fields, and measures latency.

For translation quality, I used three classic metrics: BLEU, chrF, and ROUGE-L. BLEU is a standard baseline, chrF is more robust for Japanese because it works at character level, and ROUGE-L gives a signal about sequence overlap and word order.

In addition, the pipeline logs practical checks such as “wrong language”, “copied source”, and “line count mismatch”, because these failures are common with LLM outputs.

## Slide 10 (10/14) - Quantitative Results | Metrics Snapshot
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 3/5 Results | Slide 10/14
On-slide (keywords only):
- 1.5b: BLEU 8.9 | chrF 37.1 | ROUGE-L 41.5
- 1.5b pivot: BLEU 12.9 | chrF 34.5 | ROUGE-L 40.6
- 7b: BLEU 8.8 | chrF 4.3 | ROUGE-L 39.1
- 7b pivot: BLEU 11.8 | chrF 34.9 | ROUGE-L 41.8
Visuals:
- metrics_bar.png
- latency_box.png
Oral notes (what to say):
- Explain the main trend, not every number

Text:
Here is a snapshot of the average metrics for two local models and two modes: pivot and non-pivot.

The main trend is that the 1.5B model is stable, while the 7B model can fail badly without pivot in this setup.

Pivot English usually improves BLEU and makes the system more robust, but it can slightly reduce chrF depending on the phrasing.

One detail: ROUGE-L is naturally between 0 and 1, but here it is displayed as a percentage (×100) to make it comparable on the same chart.

## Slide 11 (11/14) - Trade-offs | Quality vs Latency
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 3/5 Results | Slide 11/14
On-slide (keywords only):
- Pivot benefit
- Non-pivot failure mode
- Latency cost
- Robustness checks
Visuals:
- latency_vs_chrf.png
- Example error snippet (short)
Oral notes (what to say):
- Describe the 7b non-pivot failure pattern
- Explain why pivot improves quality but costs time

Text:
This slide shows the trade-off between quality and latency.

Pivot improves quality mainly because it reduces ambiguity: the model works with a simpler intermediate language and then generates explanations more consistently.

But pivot also costs time, because it adds extra LLM calls: an English translation step and then the analysis step.

For the 7B non-pivot mode, the typical failure patterns are: wrong target language, copying the source, or output that does not match the expected structure. The evaluation pipeline helps detect these issues systematically.

## Slide 12 (12/14) - Fine-Tuning Study | Feasibility
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 3/5 Results | Slide 12/14
On-slide (keywords only):
- Decision: not now
- Prerequisites: data volume, GPU budget
- Plan: data collection, re-evaluation
- Tools: LoRA, QLoRA, PEFT
Visuals:
- Decision matrix or cost/benefit chart
Oral notes (what to say):
- Emphasize risk/benefit and why evaluation comes first

Text:
I also studied whether fine-tuning could improve the assistant.

The conclusion is: not now. With only 50 examples, fine-tuning would likely overfit and not produce stable improvements.

To do it properly, we would need a much larger and cleaner dataset, plus a GPU budget. In that case, a realistic approach would be PEFT methods like LoRA or QLoRA using toolkits such as PEFT, LLaMA-Factory, or Axolotl.

The key point is that evaluation comes first: we need a baseline, then we can measure whether fine-tuning actually improves chrF and output stability.

## Slide 13 (13/14) - Conclusion | Impact and Next Steps
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 4/5 Wrap-up | Slide 13/14
On-slide (keywords only):
- Impact: working prototype + evaluation
- Skills: NLP, LLM, LangChain, evaluation
- Professional plan: NLP or AI engineering
- Webography: LoRA, QLoRA, LangChain book
Visuals:
- Summary box + QR codes or short URLs
Oral notes (what to say):
- Final message on learning and readiness for new projects
- Invite questions

Text:
To conclude, this internship delivered a working prototype of a French ↔ Japanese learning assistant with local inference.

The key engineering result is a structured translation API that returns not only the translation, but also explanations, hints, and grammar points, which makes the system more learner-focused and easier to evaluate.

I also delivered an evaluation pipeline that produces quantitative metrics, failure signals, and plots to compare models and modes like pivot vs non-pivot.

Next steps would be: expand the dataset, refine prompts and failure handling, and decide whether fine-tuning is worth it once we have enough data.

Thank you for listening, and I will be happy to answer your questions.

## Slide 14 (14/14) - Q&A | Questions
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 4/5 Wrap-up | Slide 14/14
On-slide (keywords only):
- Questions
- Demo (if time)
- Repository links (Resources)
Visuals:
- “Thank you” + QR code / short link
Oral notes (what to say):
- Invite questions, offer a quick live demo if requested

Text:
That is the end of my presentation.

If you have questions, I can answer them now. And if you want, I can also quickly demo the web app and show how the evaluation script generates the CSV and plots.
