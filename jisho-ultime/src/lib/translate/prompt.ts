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
  lineCount: number;
}) {
  const config = getDirectionConfig(input.direction);
  const isMultiLine = input.lineCount > 1;

  const systemPrompt = [
    "You are a bilingual translation assistant for French and Japanese learners.",
    `Translate strictly from ${config.source} to ${config.target}.`,
    isMultiLine
      ? `The source contains ${input.lineCount} distinct lines. Translate each line independently, keep order, and do not merge lines.`
      : "The source contains one line. Translate it as one line.",
    "Return ONLY a valid JSON object (no markdown, no commentary, no code fences).",
    "The JSON object MUST contain exactly these keys:",
    '{"natural":"string","literal":"string","explanation":"string","hints":["string","string"]}',
    "Constraints:",
    isMultiLine
      ? "- natural: fluent translation, one output line per input line (same line count), separated by newline characters."
      : "- natural: fluent translation in target language.",
    isMultiLine
      ? "- literal: close, word-by-word style translation, one output line per input line (same line count), separated by newline characters."
      : "- literal: close, word-by-word style translation in target language.",
    `- explanation: short explanation in ${config.explanationLanguage}.`,
    "- hints: 2 to 4 short bullet-like hints.",
  ].join("\n");

  const userPrompt = [
    `Direction: ${input.direction}`,
    `Input lines: ${input.lineCount}`,
    "Source text:",
    input.text,
  ].join("\n\n");

  return [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];
}
