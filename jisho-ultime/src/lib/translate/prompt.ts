import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import type { Direction, UILang } from "./schema";

function getDirectionConfig(direction: Direction) {
  if (direction === "fr-ja") {
    return {
      source: "French",
      target: "Japanese",
    };
  }

  return {
    source: "Japanese",
    target: "French",
  };
}

function getExplanationLanguage(uiLang: UILang) {
  return uiLang === "fr" ? "French" : "Japanese";
}

export function buildTranslationMessages(input: {
  text: string;
  direction: Direction;
  lineCount: number;
  uiLang: UILang;
}) {
  const config = getDirectionConfig(input.direction);
  const explanationLanguage = getExplanationLanguage(input.uiLang);
  const isMultiLine = input.lineCount > 1;

  const systemPrompt = [
    "You are a bilingual translation assistant for French and Japanese learners.",
    `Translate strictly from ${config.source} to ${config.target}.`,
    isMultiLine
      ? `The source contains ${input.lineCount} distinct lines. Translate each line independently, keep order, and do not merge lines.`
      : "The source contains one line. Translate it as one line.",
    "Return ONLY a valid JSON object (no markdown, no commentary, no code fences).",
    `Interface POV: ${input.uiLang === "fr" ? "French" : "Japanese"}.`,
    `The following fields must be written entirely in ${explanationLanguage}: explanation, hints, grammar[].explanation, grammar[].example, annotations[].[].notes, annotations[].[].equivalents.`,
    `Do NOT mix languages inside those fields.`,
    "The JSON object MUST contain exactly these keys:",
    '{"natural":"string","literal":"string","explanation":"string","hints":["string","string"],"annotations":[[{"display":"string","surface":"string","gloss":"string","equivalents":["string"],"lemma":"string?","pos":"string?","notes":"string?","start":0,"end":1}]],"grammar":[{"name":"string","explanation":"string","line":0,"token_span":[0,1],"example":"string?"}]}',
    "Constraints:",
    isMultiLine
      ? "- natural: fluent translation, one output line per input line (same line count), separated by newline characters."
      : "- natural: fluent translation in target language.",
    isMultiLine
      ? "- literal: close, word-by-word style translation, one output line per input line (same line count), separated by newline characters."
      : "- literal: close, word-by-word style translation in target language.",
    "- natural and literal must be true translations into the TARGET language, not copies/transliterations of the source.",
    "- Do not echo the source sentence unless a token is untranslatable (proper noun, number, URL, symbol).",
    `- explanation: short explanation in ${explanationLanguage}.`,
    `- hints: 2 to 4 short bullet-like hints in ${explanationLanguage}.`,
    "- annotations: one array per natural line, each array contains ordered tokens or segments for that line.",
    "  Each token must include display, surface, gloss, and equivalents.",
    "  display is the exact token text from the NATURAL TRANSLATION line (target language), including spacing when needed to reconstruct that translated line.",
    "  surface is the lexical unit being explained (in the source language).",
    `  gloss is a direct, literal translation into ${config.target === "Japanese" ? "Japanese" : "French"}.`,
    `  equivalents: list 2-4 alternative ${config.target === "Japanese" ? "Japanese" : "French"} translations or synonyms for the word, NOT in any other language.`,

    "  If you cannot confidently annotate a token, use an empty array for that line rather than omitting the key.",
    `- grammar: short list of grammar points used in the sentence, each tied to a line index and optional token span. Write grammar explanations in ${explanationLanguage}.`,
    "  Focus on useful learner-facing points: particles, verb forms, politeness, tense/aspect, word order, contractions, and fixed expressions.",
    "  If no grammar point is relevant, return an empty array.",
  ].join("\n");

  const userPrompt = [
    `Direction: ${input.direction}`,
    `Input lines: ${input.lineCount}`,
    "Source text:",
    input.text,
  ].join("\n\n");

  return [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];
}
