import { ChatOllama } from "@langchain/ollama";

const rawBaseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
const baseUrl = rawBaseUrl.replace("localhost", "127.0.0.1");
const model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b";

export const ollamaChat = new ChatOllama({
  baseUrl,
  model,
  temperature: 0.2,
  format: "json",
});

// For translation-only prompts where we explicitly want plain text.
// Avoids forcing JSON mode and is more deterministic.
export const ollamaChatText = new ChatOllama({
  baseUrl,
  model,
  temperature: 0,
});