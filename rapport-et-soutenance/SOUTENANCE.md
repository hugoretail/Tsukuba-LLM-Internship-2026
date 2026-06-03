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

## Slide 13 (13/14) - Project Management | Workflow and Tools
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 4/5 Wrap-up | Slide 13/14
On-slide (keywords only):
- Iterative experiments
- Reproducible runs
- Git workflow
- Risk handling: timeouts, retries
Visuals:
- Simple Kanban or loop diagram
Oral notes (what to say):
- Show you can manage project constraints and quality

## Slide 14 (14/14) - Conclusion | Impact and Next Steps
Header/Footer:
- Hugo Retail | BUT3 Internship Defense | Natural Language Processing Lab, NLP Lab | LLM Translation App | Section 4/5 Wrap-up | Slide 14/14
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
