import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import type { Direction } from "./schema";

function getDirectionConfig(direction: Direction) {
  if (direction === "fr-ja") {
    return {
      source: "French",
      target: "Japanese",
      explanationLanguage: "French",
    };
  }

  return {
    source: "Japanese",
    target: "French",
    explanationLanguage: "Japanese",
  };
}

export function buildTranslationMessages(input: {
  text: string;
  direction: Direction;
}) {
  const config = getDirectionConfig(input.direction);

  const systemPrompt = [
    "You are a bilingual translation assistant for French and Japanese learners.",
    `Translate strictly from ${config.source} to ${config.target}.`,
    "Return ONLY a valid JSON object (no markdown, no commentary, no code fences).",
    "The JSON object MUST contain exactly these keys:",
    '{"natural":"string","literal":"string","explanation":"string","hints":["string","string"]}',
    "Constraints:",
    "- natural: fluent translation in target language.",
    "- literal: close, word-by-word style translation in target language.",
    `- explanation: short explanation in ${config.explanationLanguage}.`,
    "- hints: 2 to 4 short bullet-like hints.",
  ].join("\n");

  const userPrompt = [
    `Direction: ${input.direction}`,
    "Source text:",
    input.text,
  ].join("\n\n");

  return [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];
}
