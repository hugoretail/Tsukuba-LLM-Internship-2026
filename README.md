# Tsukuba-LLM-Internship-2026

## Reading Progress

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
	- Literal translation
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

- [ ] https://zenn.dev/headwaters/articles/c0b91961749811
- [ ] https://devneko.jp/wordpress/?p=306

## Project 2 - ???

TODO

## Presentation

The final presentation of the internship will take place on:
- 6/8 (Monday), 16:00 JST (09:00 in France).

The slides used for the presentation are available here:
- https://www.canva.com/design/DAHK1jVrpeY/7Z_UJuRa8uaeUGz54QYgYA/edit

## Slack link

Discussion: https://app.slack.com/client/T03TFRDR1/C0AQCHNQ746
Schedule: https://app.slack.com/client/T03TFRDR1

## Ressources

Book in PDF: [Learning LangChain Building AI and LLM Applications with LangChain and LangGraph (Mayo Oshin, Nuno Campos)](https://ytx-readings.github.io/AI/books/LLM/LangChain/Learning%20LangChain%20Building%20AI%20and%20LLM%20Applications%20with%20LangChain%20and%20LangGraph%20(Mayo%20Oshin,%20Nuno%20Campos)%20(Z-Library).pdf)

Google Books: https://books.google.co.jp/books?id=_3VGEQAAQBAJ&pg=PR5&hl=ja&source=gbs_selected_pages&cad=1#v=onepage&q&f=false

---

