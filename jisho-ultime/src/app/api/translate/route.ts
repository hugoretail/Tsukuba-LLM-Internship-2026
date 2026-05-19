import { ollamaChat, ollamaModelName } from "@/lib/llm/ollama";
import { buildTranslationMessages } from "@/lib/translate/prompt";
import {
  translateLlmOutputSchema,
  translateRequestSchema,
  type UILang,
} from "@/lib/translate/schema";
import { SystemMessage } from "@langchain/core/messages";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const structuredTranslateModel = ollamaChat.withStructuredOutput(
  translateLlmOutputSchema,
  {
    name: "TranslationOutput",
    method: "jsonSchema",
  }
);

type ModelDebugInfo = {
  stage: "structured_output" | "raw_json" | "repair_json" | "unknown";
  structuredError?: string;
  rawError?: string;
  rawContentPreview?: string;
  parsedJsonPreview?: string;
  repairedRawPreview?: string;
  repairError?: string;
};

const translatedItemsSchema = z.object({
  items: z.array(z.string()),
});

const grammarOnlySchema = z.object({
  grammar: z.array(
    z.object({
      name: z.string().trim().min(1),
      explanation: z.string().trim().min(1),
      line: z.number().int().nonnegative(),
      token_span: z
        .tuple([
          z.number().int().nonnegative(),
          z.number().int().nonnegative(),
        ])
        .optional(),
      example: z.string().trim().min(1).optional(),
    })
  ),
});

type TranslateOutput = ReturnType<typeof translateLlmOutputSchema.parse>;

type RewriteTarget = {
  text: string;
  apply: (draft: TranslateOutput, translated: string) => void;
};

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const parsedRequest = translateRequestSchema.safeParse(body);
    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          error: "invalid request payload",
          details: parsedRequest.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { text, direction, uiLang, usePivotEnglish } = parsedRequest.data;
    // Preserve user line structure exactly (including empty lines between sentences).
    const normalizedText = text.replace(/\r\n/g, "\n");
    const lineCount = normalizedText.split("\n").length || 1;

    let pivotEnglish: string | null = null;

    let translationResult;

    if (usePivotEnglish) {
      // Pivot flow: Source -> English -> Target
      const english = await translateToEnglish(normalizedText, direction);
      pivotEnglish = english;
      // If we couldn't get an English pivot, fall back to direct single-step messages
      if (!english) {
        const fallbackMessages = buildTranslationMessages({
          text: normalizedText,
          direction,
          lineCount,
          uiLang,
        });
        translationResult = await invokeTranslationModel(fallbackMessages, uiLang);
      } else {
        // Build second-step messages: English -> original target
        const targetName = direction === "fr-ja" ? "Japanese" : "French";
        const englishLineCount = english.split("\n").length || 1;
        const secondMessages = buildTranslationMessages({
          text: english,
          source: "English",
          target: targetName,
          lineCount: englishLineCount,
          uiLang,
        });

        translationResult = await invokeTranslationModel(secondMessages, uiLang);
      }
    } else {
      const messages = buildTranslationMessages({
        text: normalizedText,
        direction,
        lineCount,
        uiLang,
      });
      translationResult = await invokeTranslationModel(messages, uiLang);
    }

    if (!translationResult.ok) {
      console.error("[translate] invalid model output", translationResult.debug);
      return NextResponse.json(
        {
          error: "invalid model output",
          details: "Could not parse/validate model output",
          debug: translationResult.debug,
        },
        { status: 502 }
      );
    }

    // Never allow raw JSON strings like {"text":"..."} to surface in the UI.
    translationResult = {
      ok: true,
      output: {
        ...translationResult.output,
        translation: sanitizeTranslationText(translationResult.output.translation),
      },
    };

    // Guardrail: small models sometimes output the translation in the UI language.
    // If the translation isn't actually in the TARGET language, retry once with stricter instruction.
    if (isWrongTargetLanguage(translationResult.output.translation, direction)) {
      const retryMessages = buildRetryMessages({
        sourceText: normalizedText,
        direction,
        uiLang,
        lineCount,
        usePivotEnglish: Boolean(usePivotEnglish),
        pivotEnglish,
      });
      const retry = await invokeTranslationModel(retryMessages, uiLang);
      if (retry.ok && !isWrongTargetLanguage(retry.output.translation, direction)) {
        translationResult = retry;
      } else {
        // Last resort: ensure at least the translation field is in the target language.
        let corrected = await translateToTargetPlain(normalizedText, direction);

        // If pivot is available, use it for an even stronger last-resort fallback.
        // This helps stubborn JA->FR cases where the model keeps copying Japanese.
        if ((!corrected || isWrongTargetLanguage(corrected, direction)) && usePivotEnglish && pivotEnglish) {
          corrected = await translatePlain({
            sourceText: pivotEnglish,
            sourceName: "English",
            targetName: getTargetName(direction),
            expectedLineCount: lineCount,
          });
        }

        if (corrected && !isWrongTargetLanguage(corrected, direction)) {
          translationResult = {
            ok: true,
            output: {
              ...translationResult.output,
              translation: corrected,
              // Avoid showing misleading hover tokens/grammar for an out-of-sync translation.
              annotations: [],
              grammar: [],
            },
          };
        }
      }
    }

    // If the model returned no grammar points, try generating 1-3 learner-facing points.
    if (translationResult.output.grammar.length === 0) {
      const augmented = await augmentGrammarIfMissing({
        output: translationResult.output,
        sourceText: normalizedText,
        direction,
        uiLang,
        pivotEnglish,
      });
      translationResult = { ok: true, output: augmented };
    }

    // Ensure explanations (including grammar explanations) are in the selected UI language.
    // This prevents English leaks for both POV Français and 日本人にとって.
    if (shouldForceExplanationToUiLanguage(translationResult.output, uiLang)) {
      const forced = await forceExplanationFieldsToUiLanguage(translationResult.output, uiLang);
      translationResult = { ok: true, output: forced };
    }

    return NextResponse.json(
      {
        input: { text, direction },
        output: translationResult.output,
        meta: {
          model: ollamaModelName,
          latencyMs: Date.now() - startedAt,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    const maybeCause =
      typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      typeof (error as { cause?: unknown }).cause === "object" &&
      (error as { cause?: unknown }).cause !== null &&
      "message" in ((error as { cause?: unknown }).cause as Record<string, unknown>)
        ? String((((error as { cause?: unknown }).cause as Record<string, unknown>).message))
        : undefined;

    return NextResponse.json(
      {
        error: "upstream LLM failure",
        details: error instanceof Error ? error.message : "Unknown error",
        cause: maybeCause,
      },
      { status: 502 }
    );
  }
}

async function invokeTranslationModel(messages: ReturnType<typeof buildTranslationMessages>, uiLang: UILang): Promise<
  | { ok: true; output: ReturnType<typeof translateLlmOutputSchema.parse> }
  | { ok: false; debug: ModelDebugInfo }
> {
  try {
    const rawOutput = await structuredTranslateModel.invoke(messages);
    // Ensure type is strictly TranslateLlmOutput by validating through schema
    const parsedRawOutput = translateLlmOutputSchema.parse(rawOutput);
    const output = await ensureOutputLanguage(parsedRawOutput, uiLang);
    return { ok: true, output };
  } catch (structuredError) {
    const aiMessage = await ollamaChat.invoke(messages);
    const rawContent =
      typeof aiMessage.content === "string"
        ? aiMessage.content.trim()
        : JSON.stringify(aiMessage.content);

    const parsedOutput = await parseModelOutputWithRepair(rawContent, uiLang);
    if (!parsedOutput.ok) {
      return {
        ok: false,
        debug: {
          stage: parsedOutput.debug.stage,
          structuredError: normalizeError(structuredError),
          rawError: parsedOutput.debug.rawError,
          rawContentPreview: rawContent.slice(0, 800),
          parsedJsonPreview: parsedOutput.debug.parsedJsonPreview,
          repairedRawPreview: parsedOutput.debug.repairedRawPreview,
          repairError: parsedOutput.debug.repairError,
        },
      };
    }

    return { ok: true, output: parsedOutput.output };
  }
}

async function parseModelOutputWithRepair(rawContent: string, uiLang: UILang): Promise<
  | { ok: true; output: Awaited<ReturnType<typeof translateLlmOutputSchema.parse>> }
  | { ok: false; debug: ModelDebugInfo }
> {
  const parsedJson = parseModelJson(rawContent);
  if (parsedJson) {
    const parsedOutput = translateLlmOutputSchema.safeParse(normalizeModelOutput(parsedJson));
    if (parsedOutput.success) {
      const output = await ensureOutputLanguage(parsedOutput.data, uiLang);
      return { ok: true, output };
    }
  }

  const repairedRaw = await requestJsonRepair(rawContent);
  if (!repairedRaw) {
    return {
      ok: false,
      debug: {
        stage: parsedJson ? "raw_json" : "unknown",
        parsedJsonPreview: previewUnknown(parsedJson),
      },
    };
  }

  const repairedJson = parseModelJson(repairedRaw);
  if (!repairedJson) {
    return {
      ok: false,
      debug: {
        stage: "repair_json",
        parsedJsonPreview: previewUnknown(parsedJson),
        repairedRawPreview: repairedRaw.slice(0, 800),
      },
    };
  }

  const repairedOutput = translateLlmOutputSchema.safeParse(normalizeModelOutput(repairedJson));
  if (!repairedOutput.success) {
    return {
      ok: false,
      debug: {
        stage: "repair_json",
        parsedJsonPreview: previewUnknown(parsedJson),
        repairedRawPreview: repairedRaw.slice(0, 800),
      },
    };
  }

  const output = await ensureOutputLanguage(repairedOutput.data, uiLang);
  return { ok: true, output };
}

function normalizeModelOutput(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const raw = value as Record<string, unknown>;
  const translation = pickFirstString(raw.translation, raw.natural, raw.literal);
  const explanation = pickFirstString(raw.explanation);
  const hints = normalizeStringArray(raw.hints);
  const annotations = normalizeAnnotations(raw.annotations);
  const grammar = normalizeGrammar(raw.grammar);

  return {
    translation: translation ?? "",
    explanation: explanation ?? "",
    hints,
    annotations,
    grammar,
  };
}

function pickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is string => item.length > 0);
}

function normalizeAnnotations(value: unknown): TranslateOutput["annotations"] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.length === 0) {
    return [];
  }

  const firstItem = value[0];
  if (Array.isArray(firstItem)) {
    return value.map((line) => normalizeAnnotationLine(line));
  }

  return [normalizeAnnotationLine(value)];
}

function normalizeAnnotationLine(value: unknown): TranslateOutput["annotations"][number] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeAnnotationToken(item))
    .filter((item): item is NonNullable<ReturnType<typeof normalizeAnnotationToken>> => item !== null);
}

function normalizeAnnotationToken(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const display = pickFirstString(raw.display);
  const surface = pickFirstString(raw.surface);
  const gloss = pickFirstString(raw.gloss);
  const equivalents = normalizeStringArray(raw.equivalents);
  const antonyms = normalizeStringArray(raw.antonyms);

  if (!display || !surface || !gloss || equivalents.length === 0) {
    return null;
  }

  return {
    display,
    surface,
    gloss,
    equivalents: equivalents.slice(0, 4),
    antonyms: antonyms.length > 0 ? antonyms.slice(0, 2) : undefined,
    lemma: pickFirstString(raw.lemma),
    pos: pickFirstString(raw.pos),
    notes: pickFirstString(raw.notes),
    start: typeof raw.start === "number" ? raw.start : undefined,
    end: typeof raw.end === "number" ? raw.end : undefined,
  };
}

function normalizeGrammar(value: unknown): TranslateOutput["grammar"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeGrammarPoint(item))
    .filter((item): item is NonNullable<ReturnType<typeof normalizeGrammarPoint>> => item !== null);
}

function normalizeGrammarPoint(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const name = pickFirstString(raw.name, raw.content, raw.title);
  const explanation = pickFirstString(raw.explanation, raw.content);
  const example = pickFirstString(raw.example, raw.examples);
  const tokenSpan = normalizeTokenSpan(raw.token_span);
  const line = typeof raw.line === "number" ? raw.line : 0;

  if (!name || !explanation) {
    return null;
  }

  return {
    name,
    explanation,
    line,
    token_span: tokenSpan,
    example,
  };
}

function normalizeTokenSpan(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }

  const start = value[0];
  const end = value[1];
  if (typeof start !== "number" || typeof end !== "number") {
    return undefined;
  }

  return [start, end];
}

async function ensureOutputLanguage(
  output: TranslateOutput,
  uiLang: UILang
) {
  if (!containsWrongScript(output, uiLang)) {
    return output;
  }

  const repairPrompt = [
    "Rewrite ONLY the explanation-related fields of the following translation output so that they are fully in the selected UI language.",
    `Selected UI language: ${uiLang === "fr" ? "French" : "Japanese"}.`,
    "Keep translation, annotations and grammar structure unchanged except for language of explanation fields.",
    "Fields to rewrite: explanation, hints, grammar[].explanation, grammar[].example, annotations[].[].notes, annotations[].[].equivalents.",
    "Return ONLY valid JSON using the same shape as the input object.",
    "Input JSON:",
    JSON.stringify(output),
  ].join("\n");

  const repaired = await ollamaChat.invoke(repairPrompt);
  const raw = typeof repaired.content === "string" ? repaired.content.trim() : JSON.stringify(repaired.content);
  const parsed = parseModelJson(raw);
  if (!parsed) {
    return await rewriteWrongLanguageFields(output, uiLang);
  }

  const validated = translateLlmOutputSchema.safeParse(parsed);
  if (!validated.success) {
    return await rewriteWrongLanguageFields(output, uiLang);
  }

  if (!containsWrongScript(validated.data, uiLang)) {
    return validated.data;
  }

  return await rewriteWrongLanguageFields(validated.data, uiLang);
}

async function rewriteWrongLanguageFields(output: TranslateOutput, uiLang: UILang) {
  const targets = collectRewriteTargets(output, uiLang);
  if (targets.length === 0) {
    return output;
  }

  const translatedItems = await translateItemsToUiLanguage(
    targets.map((target) => target.text),
    uiLang
  );

  if (!translatedItems || translatedItems.length !== targets.length) {
    return output;
  }

  const draft = structuredClone(output);
  targets.forEach((target, index) => {
    const translated = translatedItems[index]?.trim();
    if (translated && translated.length > 0) {
      target.apply(draft, translated);
    }
  });

  const reparsed = translateLlmOutputSchema.safeParse(draft);
  return reparsed.success ? reparsed.data : output;
}

function collectRewriteTargets(output: TranslateOutput, uiLang: UILang): RewriteTarget[] {
  const targets: RewriteTarget[] = [];

  if (isWrongScript(output.explanation, uiLang)) {
    targets.push({
      text: output.explanation,
      apply: (draft, translated) => {
        draft.explanation = translated;
      },
    });
  }

  output.hints.forEach((hint, hintIndex) => {
    if (!isWrongScript(hint, uiLang)) {
      return;
    }

    targets.push({
      text: hint,
      apply: (draft, translated) => {
        draft.hints[hintIndex] = translated;
      },
    });
  });

  output.grammar.forEach((point, pointIndex) => {
    if (isWrongScript(point.explanation, uiLang)) {
      targets.push({
        text: point.explanation,
        apply: (draft, translated) => {
          draft.grammar[pointIndex].explanation = translated;
        },
      });
    }

    if (point.example && isWrongScript(point.example, uiLang)) {
      targets.push({
        text: point.example,
        apply: (draft, translated) => {
          draft.grammar[pointIndex].example = translated;
        },
      });
    }
  });

  output.annotations.forEach((line, lineIndex) => {
    line.forEach((token, tokenIndex) => {
      if (token.notes && isWrongScript(token.notes, uiLang)) {
        targets.push({
          text: token.notes,
          apply: (draft, translated) => {
            draft.annotations[lineIndex][tokenIndex].notes = translated;
          },
        });
      }

      token.equivalents.forEach((equivalent, equivalentIndex) => {
        if (!isWrongScript(equivalent, uiLang)) {
          return;
        }

        targets.push({
          text: equivalent,
          apply: (draft, translated) => {
            draft.annotations[lineIndex][tokenIndex].equivalents[equivalentIndex] = translated;
          },
        });
      });
    });
  });

  return targets;
}

async function translateItemsToUiLanguage(items: string[], uiLang: UILang): Promise<string[] | null> {
  if (items.length === 0) {
    return [];
  }

  const targetLanguage = uiLang === "fr" ? "French" : "Japanese";
  const translator = ollamaChat.withStructuredOutput(translatedItemsSchema, {
    name: "TranslatedItems",
    method: "jsonSchema",
  });

  try {
    const response = await translator.invoke([
      `Translate every item into ${targetLanguage}.`,
      "Keep the same order and keep each item concise.",
      "Return ONLY valid JSON with key items.",
      `Input items JSON: ${JSON.stringify(items)}`,
    ].join("\n"));

    return response.items;
  } catch {
    return null;
  }
}

async function forceExplanationFieldsToUiLanguage(output: TranslateOutput, uiLang: UILang) {
  const targets = collectAllExplanationTargets(output);
  if (targets.length === 0) {
    return output;
  }

  const translatedItems = await translateItemsToUiLanguage(
    targets.map((target) => target.text),
    uiLang
  );

  if (!translatedItems || translatedItems.length !== targets.length) {
    return output;
  }

  const draft = structuredClone(output);
  targets.forEach((target, index) => {
    const translated = translatedItems[index]?.trim();
    if (translated && translated.length > 0) {
      target.apply(draft, translated);
    }
  });

  const reparsed = translateLlmOutputSchema.safeParse(draft);
  return reparsed.success ? reparsed.data : output;
}

function collectAllExplanationTargets(output: TranslateOutput): RewriteTarget[] {
  const targets: RewriteTarget[] = [];

  if (output.explanation.trim().length > 0) {
    targets.push({
      text: output.explanation,
      apply: (draft, translated) => {
        draft.explanation = translated;
      },
    });
  }

  output.hints.forEach((hint, hintIndex) => {
    if (hint.trim().length === 0) {
      return;
    }

    targets.push({
      text: hint,
      apply: (draft, translated) => {
        draft.hints[hintIndex] = translated;
      },
    });
  });

  output.grammar.forEach((point, pointIndex) => {
    if (point.name.trim().length > 0) {
      targets.push({
        text: point.name,
        apply: (draft, translated) => {
          draft.grammar[pointIndex].name = translated;
        },
      });
    }

    if (point.explanation.trim().length > 0) {
      targets.push({
        text: point.explanation,
        apply: (draft, translated) => {
          draft.grammar[pointIndex].explanation = translated;
        },
      });
    }

    if (point.example && point.example.trim().length > 0) {
      targets.push({
        text: point.example,
        apply: (draft, translated) => {
          draft.grammar[pointIndex].example = translated;
        },
      });
    }
  });

  output.annotations.forEach((line, lineIndex) => {
    line.forEach((token, tokenIndex) => {
      if (token.notes && token.notes.trim().length > 0) {
        targets.push({
          text: token.notes,
          apply: (draft, translated) => {
            draft.annotations[lineIndex][tokenIndex].notes = translated;
          },
        });
      }

      token.equivalents.forEach((equivalent, equivalentIndex) => {
        if (equivalent.trim().length === 0) {
          return;
        }

        targets.push({
          text: equivalent,
          apply: (draft, translated) => {
            draft.annotations[lineIndex][tokenIndex].equivalents[equivalentIndex] = translated;
          },
        });
      });
    });
  });

  return targets;
}

async function augmentGrammarIfMissing(input: {
  output: TranslateOutput;
  sourceText: string;
  direction: "fr-ja" | "ja-fr";
  uiLang: UILang;
  pivotEnglish: string | null;
}) {
  if (input.output.grammar.length > 0) {
    return input.output;
  }

  const explanationLanguage = input.uiLang === "fr" ? "French" : "Japanese";
  const sourceName = input.direction === "fr-ja" ? "French" : "Japanese";
  const targetName = getTargetName(input.direction);
  const sourceForContext = input.pivotEnglish && input.pivotEnglish.trim().length > 0
    ? `English pivot text:\n${input.pivotEnglish}`
    : `Source text (${sourceName}):\n${input.sourceText}`;

  const grammarModel = ollamaChat.withStructuredOutput(grammarOnlySchema, {
    name: "GrammarOnly",
    method: "jsonSchema",
  });

  try {
    const response = await grammarModel.invoke([
      "Extract 1 to 3 learner-facing grammar points that are notable in this translation.",
      `Write explanations and examples in ${explanationLanguage}.`,
      "Return ONLY valid JSON with key grammar.",
      "Each grammar item must include: name, explanation, line (0-based). token_span and example are optional.",
      "Do not invent facts; keep it concise.",
      sourceForContext,
      `Translation (${targetName}):\n${input.output.translation}`,
    ].join("\n\n"));

    const draft = structuredClone(input.output);
    draft.grammar = response.grammar;
    const validated = translateLlmOutputSchema.safeParse(draft);
    return validated.success ? validated.data : input.output;
  } catch {
    return input.output;
  }
}

function isWrongScript(text: string, uiLang: UILang) {
  if (uiLang === "fr") {
    return /[\u3040-\u30ff\u4e00-\u9faf]/u.test(text);
  }

  return /[A-Za-z]/u.test(text);
}

function containsWrongScript(
  output: TranslateOutput,
  uiLang: UILang
) {
  const text = [
    output.explanation,
    ...output.hints,
    ...output.grammar.map((point) => [point.explanation, point.example ?? ""].join(" ")),
    ...output.annotations.flatMap((line) => line.map((token) => [token.notes ?? "", ...token.equivalents].join(" "))),
  ].join("\n");

  return isWrongScript(text, uiLang);
}

async function requestJsonRepair(rawContent: string): Promise<string | null> {
  const repairPrompt = [
    "Rewrite the following output into STRICT valid JSON.",
    "Return ONLY JSON with exactly these keys:",
    '{"translation":"string","explanation":"string","hints":["string","string"],"annotations":[[{"display":"string","surface":"string","gloss":"string","equivalents":["string"],"lemma":"string?","pos":"string?","notes":"string?","start":0,"end":1}]],"grammar":[{"name":"string","explanation":"string","line":0,"token_span":[0,1],"example":"string?"}]}',
    "Rules:",
    "- Keep meaning unchanged.",
    "- hints must contain between 2 and 4 strings.",
    "- annotations must contain one token array per translation line, and each token must include display, surface, gloss, and equivalents.",
    "- grammar must describe learner-facing points used in the translation.",
    "- No markdown, no code fences, no extra keys.",
    "Raw output:",
    rawContent,
  ].join("\n");

  try {
    const repairedMessage = await ollamaChat.invoke(repairPrompt);
    return typeof repairedMessage.content === "string"
      ? repairedMessage.content.trim()
      : JSON.stringify(repairedMessage.content);
  } catch {
    return null;
  }
}

function previewUnknown(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value.slice(0, 400);
  }

  try {
    return JSON.stringify(value).slice(0, 400);
  } catch {
    return String(value).slice(0, 400);
  }
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function parseModelJson(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(stripCodeFence(trimmed));
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      return null;
    }

    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

function stripCodeFence(rawText: string): string {
  if (!rawText.startsWith("```")) {
    return rawText;
  }

  return rawText
    .replace(/^```[a-zA-Z]*\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
}

function isWrongTargetLanguage(translation: string, direction: "fr-ja" | "ja-fr") {
  const trimmed = translation.trim();
  if (!trimmed) {
    return true;
  }

  // Never accept JSON blobs as "translation".
  if (looksLikeJsonString(trimmed)) {
    return true;
  }

  const hasJapanese = /[\u3040-\u30ff\u4e00-\u9faf]/u.test(trimmed);
  const hasLatin = /[A-Za-zÀ-ÖØ-öø-ÿ]/u.test(trimmed);

  if (direction === "fr-ja") {
    // Target is Japanese: must contain some Japanese script.
    return !hasJapanese;
  }

  // direction === 'ja-fr' (target is French): should not contain Japanese script.
  // If it contains Japanese, consider it wrong even if there are some Latin chars.
  return hasJapanese || !hasLatin;
}

function looksLikeJsonString(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (!(trimmed.startsWith("{") && trimmed.endsWith("}")) && !(trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function sanitizeTranslationText(translation: string) {
  const trimmed = translation.trim();
  if (!trimmed) {
    return translation;
  }

  if (!looksLikeJsonString(trimmed)) {
    return translation;
  }

  const extracted = extractPlainTextFromMaybeJson(trimmed);
  return extracted ?? translation;
}

function extractPlainTextFromMaybeJson(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed === "string") {
    return parsed.trim();
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const direct = pickFirstString(obj.translation, obj.text, obj.result, obj.output);
  if (direct) {
    return direct;
  }

  // As a last resort, pick the first string-ish leaf.
  for (const value of Object.values(obj)) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getExplanationCorpus(output: TranslateOutput): string {
  return [
    output.explanation,
    ...output.hints,
    ...output.grammar.flatMap((g) => [g.name, g.explanation, g.example ?? ""]),
    ...output.annotations.flatMap((line) =>
      line.flatMap((token) => [token.notes ?? "", ...token.equivalents])
    ),
  ].join("\n");
}

function shouldForceExplanationToUiLanguage(output: TranslateOutput, uiLang: UILang) {
  const corpus = getExplanationCorpus(output);
  if (!corpus.trim()) {
    return false;
  }

  if (uiLang === "ja") {
    // If UI language is Japanese, any noticeable Latin script suggests English/French leaked in.
    return /[A-Za-zÀ-ÖØ-öø-ÿ]/u.test(corpus);
  }

  // uiLang === 'fr'
  // If French UI, rewrite if Japanese is present OR if it looks like English.
  if (/[\u3040-\u30ff\u4e00-\u9faf]/u.test(corpus)) {
    return true;
  }

  // Simple English heuristic: common function words.
  return /\b(the|and|to|of|is|are|was|were|in|for|with|this|that|you|your|we|they)\b/i.test(corpus);
}

function getTargetName(direction: "fr-ja" | "ja-fr") {
  return direction === "fr-ja" ? "Japanese" : "French";
}

function buildRetryMessages(input: {
  sourceText: string;
  direction: "fr-ja" | "ja-fr";
  uiLang: UILang;
  lineCount: number;
  usePivotEnglish: boolean;
  pivotEnglish: string | null;
}): ReturnType<typeof buildTranslationMessages> {
  const targetName = getTargetName(input.direction);

  const baseMessages = input.usePivotEnglish && input.pivotEnglish
    ? buildTranslationMessages({
        text: input.pivotEnglish,
        source: "English",
        target: targetName,
        lineCount: input.lineCount,
        uiLang: input.uiLang,
      })
    : buildTranslationMessages({
        text: input.sourceText,
        direction: input.direction,
        lineCount: input.lineCount,
        uiLang: input.uiLang,
      });

  const strictPrefix = new SystemMessage([
    "CRITICAL REQUIREMENT:",
    `- The JSON field \"translation\" MUST be written in ${targetName} ONLY.`,
    input.lineCount > 1
      ? `- Preserve line breaks exactly: output must contain ${input.lineCount} lines.`
      : "- Output must be a single line.",
    "- The UI POV language only applies to explanation/hints/notes; it must NOT change the translation language.",
    "If you output the translation in the wrong language, you failed.",
  ].join("\n"));

  return [strictPrefix, ...baseMessages];
}

async function translateToTargetPlain(sourceText: string, direction: "fr-ja" | "ja-fr") {
  const sourceName = direction === "fr-ja" ? "French" : "Japanese";
  const targetName = getTargetName(direction);
  const expectedLineCount = sourceText.split("\n").length || 1;
  return await translatePlain({
    sourceText,
    sourceName,
    targetName,
    expectedLineCount,
  });
}

async function translateToEnglish(sourceText: string, direction: "fr-ja" | "ja-fr") {
  const sourceName = direction === "fr-ja" ? "French" : "Japanese";
  const expectedLineCount = sourceText.split("\n").length || 1;
  return await translatePlain({
    sourceText,
    sourceName,
    targetName: "English",
    expectedLineCount,
  });
}

async function translatePlain(input: {
  sourceText: string;
  sourceName: string;
  targetName: string;
  expectedLineCount: number;
}) {
  const prompt = [
    `Translate strictly from ${input.sourceName} to ${input.targetName}.`,
    "Preserve line breaks exactly and do not merge or split lines.",
    input.expectedLineCount > 1
      ? `The source contains ${input.expectedLineCount} lines; output must contain exactly ${input.expectedLineCount} lines.`
      : "The source contains one line; output must be one line.",
    `Return ONLY the plain translated text in ${input.targetName}.`,
    "No JSON, no commentary, no code fences.",
    `If you include any text in a different language than ${input.targetName}, you failed.`,
    "Source text:",
    input.sourceText,
  ].join("\n\n");

  try {
    const response = await ollamaChat.invoke(prompt as unknown as string);
    const raw = typeof response.content === "string" ? response.content.trim() : JSON.stringify(response.content);
    return sanitizeTranslationText(stripCodeFence(raw));
  } catch {
    return null;
  }
}