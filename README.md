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

### MVP Scope (Phase 1)

- Translation FR <-> JA specialized for learner use-cases
- Guided output modes:
	- Natural translation
	- Literal translation
	- Short explanation of lexical/grammar choices
- Basic grammar hints (particles, politeness level, tense/aspect markers)
- Local-first inference with Ollama

### Notes

NONE

### Issues

- Insuffisances du modèle : prompt pas assez développé
- Hallucinations : prompts trop détaillés
- Tâches difficiles : traductions FR<->JA alors que le modèle n'a pas été entrainé sur beaucoup de texte comme ça
- Contexte trop gros : plusieurs tâches en un seul prompt. Séparer les tâches en plusieurs prompts (traduction puis explication)

### Backlog (Phase 2)

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

## Slack link

Discussion: https://app.slack.com/client/T03TFRDR1/C0AQCHNQ746
Schedule: https://app.slack.com/client/T03TFRDR1

## Ressources

Book in PDF: [Learning LangChain Building AI and LLM Applications with LangChain and LangGraph (Mayo Oshin, Nuno Campos)](https://ytx-readings.github.io/AI/books/LLM/LangChain/Learning%20LangChain%20Building%20AI%20and%20LLM%20Applications%20with%20LangChain%20and%20LangGraph%20(Mayo%20Oshin,%20Nuno%20Campos)%20(Z-Library).pdf)

Google Books: https://books.google.co.jp/books?id=_3VGEQAAQBAJ&pg=PR5&hl=ja&source=gbs_selected_pages&cad=1#v=onepage&q&f=false

---

