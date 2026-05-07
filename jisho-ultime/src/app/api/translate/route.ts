import { ollamaChat, ollamaModelName } from "@/lib/llm/ollama";
import { buildTranslationMessages } from "@/lib/translate/prompt";
import {
  translateLlmOutputSchema,
  translateRequestSchema,
  type UILang,
} from "@/lib/translate/schema";
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

    const { text, direction, uiLang } = parsedRequest.data;
    // Preserve user line structure exactly (including empty lines between sentences).
    const normalizedText = text.replace(/\r\n/g, "\n");
    const lineCount = normalizedText.split("\n").length || 1;

    const messages = buildTranslationMessages({
      text: normalizedText,
      direction,
      lineCount,
      uiLang,
    });
    const translationResult = await invokeTranslationModel(messages, uiLang);

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
    const parsedOutput = translateLlmOutputSchema.safeParse(parsedJson);
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

  const repairedOutput = translateLlmOutputSchema.safeParse(repairedJson);
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
    "Keep natural, literal, annotations and grammar structure unchanged except for language of explanation fields.",
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
    '{"natural":"string","literal":"string","explanation":"string","hints":["string","string"],"annotations":[[{"display":"string","surface":"string","gloss":"string","equivalents":["string"],"lemma":"string?","pos":"string?","notes":"string?","start":0,"end":1}]],"grammar":[{"name":"string","explanation":"string","line":0,"token_span":[0,1],"example":"string?"}]}',
    "Rules:",
    "- Keep meaning unchanged.",
    "- hints must contain between 2 and 4 strings.",
    "- annotations must contain one token array per natural line, and each token must include display, surface, gloss, and equivalents.",
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