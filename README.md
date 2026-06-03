# Tsukuba-LLM-Internship-2026

## LangChain Reading Progress

- [x] Preface
- [x] CHAPTER 1 - LLM Fundamentals with LangChain
- [x] CHAPTER 2 - RAG Part 1: Indexing your data
- [x] CHAPTER 3 - RAG Part 2: Chatting with your data
- [x] CHAPTER 4 - Using LangGraph to Add Memory to Your Chatbot
- [x] CHAPTER 5 - Cognitive Architectures with LangGraph

## Project 1 - FR <-> JA Learning Assistant (LLM + Ollama + LangChain)

### Goal

Build a French <-> Japanese learning assistant powered by a local/open-source LLM stack (Ollama), with LangChain/LangGraph orchestration.

### Phase 1 Project Plan

- Translation FR <-> JA specialized for learner use-cases
- Guided output modes:
	- Natural translation
	- Short explanation of lexical/grammar choices
- Basic grammar hints (particles, politeness level, tense/aspect markers)
- Local-first inference with Ollama

### Issues

- Limitations of the model: prompt not detailed enough
- Hallucinations: prompts too detailed
- Difficult tasks: FR<->JA translations, even though the model hasn't been trained on much text like this
- Context too broad: multiple tasks in a single prompt. Split the tasks into separate prompts (translation followed by explanation)

### DLC [TODO]

- Exercise generation (fill-in-the-blank, rephrase, translate-back)
  > TODO: ADD MORE EXERCISES (fun and tryharding ones)
- Correction and feedback with explanation
- Vocabulary extraction + review lists
  > TODO: REVIEW THIS AND MAYBE ADD A FLASHCARD SYSTEM (like Anki App, though it may be out of context for this app)
- Conversation role-play scenarios (daily life, lab, admin)
- Learner memory (common mistakes + spaced repetition support)

### Evaluation

Metric references and tooling links are listed in the **Resources** section.

## Presentation

The final presentation of the internship will take place on:
- 6/8 (Monday), 16:00 JST (09:00 in France).

The slides used for the presentation are available here:
- https://www.canva.com/design/DAHK1jVrpeY/7Z_UJuRa8uaeUGz54QYgYA/edit

## Slack link

Discussion: https://app.slack.com/client/T03TFRDR1/C0AQCHNQ746
Schedule: https://app.slack.com/client/T03TFRDR1

## Resources

Last accessed on 3 June 2026.

### Reference book

- Oshin, M.; Campos, N. *Learning LangChain: Building AI and LLM Applications with LangChain and LangGraph*. Google Books, [online]. Available: https://books.google.co.jp/books?id=_3VGEQAAQBAJ

### Technical documentation

- LangChain (JavaScript/TypeScript) documentation, [online]. Available: https://js.langchain.com/docs/
- LangGraph documentation, [online]. Available: https://langchain-ai.github.io/langgraph/
- Ollama documentation, [online]. Available: https://ollama.com/

### Evaluation metrics (overviews)

- Headwaters, “NLP evaluation metrics overview (BLEU / METEOR / ROUGE / etc.)”, Zenn, [online]. Available: https://zenn.dev/headwaters/articles/c0b91961749811
- devneko, “BARTScore overview/notes”, [online]. Available: https://devneko.jp/wordpress/?p=306

### Python libraries used in evaluation

- Post, M. “sacreBLEU”, [software]. Available: https://github.com/mjpost/sacrebleu
- seaborn documentation, [online]. Available: https://seaborn.pydata.org/

### Fine-tuning references and toolkits

- Hu, E. J. et al. “LoRA: Low-Rank Adaptation of Large Language Models”, arXiv:2106.09685, [online]. Available: https://arxiv.org/abs/2106.09685
- Dettmers, T. et al. “QLoRA: Efficient Finetuning of Quantized LLMs”, arXiv:2305.14314, [online]. Available: https://arxiv.org/abs/2305.14314
- Hugging Face PEFT (LoRA/adapters), [software]. Available: https://github.com/huggingface/peft
- LLaMA-Factory, [software]. Available: https://github.com/hiyouga/LLaMA-Factory
- Axolotl, [software]. Available: https://github.com/axolotl-ai-cloud/axolotl

---

