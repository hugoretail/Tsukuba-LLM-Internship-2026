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

type AnalysisLang = UILang | "en";

function getAnalysisLanguageName(lang: AnalysisLang) {
  if (lang === "fr") {
    return "French";
  }

  if (lang === "ja") {
    return "Japanese";
  }

  return "English";
}

export function buildTranslationMessages(input: {
  text: string;
  direction?: Direction;
  source?: string; // e.g. 'English', 'French', 'Japanese' - overrides direction if provided
  target?: string; // e.g. 'French' or 'Japanese' - used when source/target override is provided
  lineCount: number;
  uiLang: UILang;
}) {
  const config = input.direction ? getDirectionConfig(input.direction) : undefined;
  const sourceName = input.source ?? config?.source ?? "French";
  const targetName = input.target ?? config?.target ?? "Japanese";
  const explanationLanguage = getExplanationLanguage(input.uiLang);
  const isMultiLine = input.lineCount > 1;
  const uiLanguageName = input.uiLang === "fr" ? "French" : "Japanese";

  const systemPrompt = [
    "You are a bilingual translation assistant for French and Japanese learners.",
    `Translate strictly from ${sourceName} to ${targetName}.`,
    isMultiLine
      ? `The source contains ${input.lineCount} distinct lines. Translate each line independently, keep order, and do not merge lines.`
      : "The source contains one line. Translate it as one line.",
    "Return ONLY a valid JSON object (no markdown, no commentary, no code fences).",
    `Interface POV language: ${uiLanguageName}.`,
    "Use this exact top-level shape: translation, explanation, hints, annotations, grammar.",
    "Constraints:",
    isMultiLine
      ? "- translation: fluent translation, one output line per input line (same line count), separated by newline characters."
      : "- translation: fluent translation in target language.",
    "- translation must be a true translation into the TARGET language.",
    "- Do not echo/copy the full source sentence.",
    `- explanation: short explanation in ${explanationLanguage}.`,
    `- hints: 2 to 4 short bullet-like hints in ${explanationLanguage}.`,
    "- annotations: one array per translation line, ordered tokens/segments for that line.",
    "- token fields: display, surface, gloss, equivalents are required; lemma/pos/notes/antonyms are optional.",
    "- display: exact token text from the translation line.",
    "- surface: source-language lexical unit.",
    `- gloss: direct translation in ${targetName}.`,
    `- equivalents: 2-4 alternatives in ${uiLanguageName} (UI language), never in another language.`,
    "- antonyms: optional, up to 2 learner-useful items.",
    `- annotations[].notes must be in ${explanationLanguage}.`,
    "- if uncertain for a line, return an empty array for that line.",
    `- grammar: short learner-facing list (1 to 3 points when possible), each point with line and optional token_span; explanations in ${explanationLanguage}.`,
    "- only return an empty grammar array if there is truly nothing notable.",
  ].join("\n");

  const directionLine = input.direction
    ? `Direction: ${input.direction}`
    : `Direction: ${sourceName} -> ${targetName}`;

  const userPrompt = [
    directionLine,
    `Input lines: ${input.lineCount}`,
    `Source language: ${sourceName}`,
    `Target language: ${targetName}`,
    "Source text:",
    input.text,
  ].join("\n\n");

  return [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];
}

export function buildTranslationAnalysisMessages(input: {
  sourceText: string;
  translation: string;
  direction?: Direction;
  source?: string;
  target?: string;
  lineCount: number;
  uiLang: UILang;
  analysisLang?: AnalysisLang;
}) {
  const config = input.direction ? getDirectionConfig(input.direction) : undefined;
  const sourceName = input.source ?? config?.source ?? "French";
  const targetName = input.target ?? config?.target ?? "Japanese";
  const analysisLang = input.analysisLang ?? input.uiLang;
  const explanationLanguage = analysisLang === "en" ? "English" : getExplanationLanguage(analysisLang);
  const isMultiLine = input.lineCount > 1;
  const uiLanguageName = getAnalysisLanguageName(analysisLang);

  const systemPrompt = [
    "You are a bilingual translation analysis assistant for French and Japanese learners.",
    `The translation from ${sourceName} to ${targetName} is already provided.`,
    "DO NOT re-translate and DO NOT change the translation.",
    isMultiLine
      ? `The source/translation contain ${input.lineCount} lines. Keep line order; grammar.line is 0-based.`
      : "The source/translation contain one line.",
    "Return ONLY a valid JSON object (no markdown, no commentary, no code fences).",
    `Interface POV language: ${uiLanguageName}.`,
    "Use this exact top-level shape: translation, explanation, hints, annotations, grammar.",
    "Rules:",
    "- translation: MUST be exactly the provided translation string.",
    `- explanation: short explanation in ${explanationLanguage}.`,
    `- hints: 2 to 4 short hints in ${explanationLanguage}.`,
    "- annotations: OPTIONAL. If you are not confident, return an empty array.",
    "- if annotations is provided for multi-line, it must be one array per line; otherwise return [].",
    "- grammar: 1 to 3 points when possible (else []), each with name, explanation, line (0-based), optional token_span.",
    `- Write grammar explanations in ${explanationLanguage}.`,
    analysisLang === "en" ? "- Write grammar point names (grammar[].name) in English." : "",
    "- Do not invent facts; keep it learner-focused.",
  ].join("\n");

  const directionLine = input.direction
    ? `Direction: ${input.direction}`
    : `Direction: ${sourceName} -> ${targetName}`;

  const userPrompt = [
    directionLine,
    `Input lines: ${input.lineCount}`,
    `Source language: ${sourceName}`,
    `Target language: ${targetName}`,
    "Source text:",
    input.sourceText,
    "Provided translation (MUST copy exactly into JSON.translation):",
    input.translation,
  ].join("\n\n");

  return [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];
}
