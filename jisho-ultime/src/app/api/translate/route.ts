import { ollamaChat, ollamaModelName } from "@/lib/llm/ollama";
import { buildTranslationMessages } from "@/lib/translate/prompt";
import {
  translateLlmOutputSchema,
  translateRequestSchema,
} from "@/lib/translate/schema";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

    const { text, direction } = parsedRequest.data;
    const sourceLines = text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const normalizedText = sourceLines.join("\n");
    const lineCount = sourceLines.length || 1;

    const messages = buildTranslationMessages({
      text: normalizedText,
      direction,
      lineCount,
    });
    const aiMessage = await ollamaChat.invoke(messages);
    const rawContent =
      typeof aiMessage.content === "string"
        ? aiMessage.content.trim()
        : JSON.stringify(aiMessage.content);

    const parsedOutput = await parseModelOutputWithRepair(rawContent);
    if (!parsedOutput) {
      return NextResponse.json(
        {
          error: "invalid model output",
          details: "Could not parse/validate model JSON output",
          raw: rawContent.slice(0, 500),
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        input: { text, direction },
        output: parsedOutput,
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

async function parseModelOutputWithRepair(rawContent: string) {
  const parsedJson = parseModelJson(rawContent);
  if (parsedJson) {
    const parsedOutput = translateLlmOutputSchema.safeParse(parsedJson);
    if (parsedOutput.success) {
      return parsedOutput.data;
    }
  }

  const repairedRaw = await requestJsonRepair(rawContent);
  if (!repairedRaw) {
    return null;
  }

  const repairedJson = parseModelJson(repairedRaw);
  if (!repairedJson) {
    return null;
  }

  const repairedOutput = translateLlmOutputSchema.safeParse(repairedJson);
  if (!repairedOutput.success) {
    return null;
  }

  return repairedOutput.data;
}

async function requestJsonRepair(rawContent: string): Promise<string | null> {
  const repairPrompt = [
    "Rewrite the following output into STRICT valid JSON.",
    "Return ONLY JSON with exactly these keys:",
    '{"natural":"string","literal":"string","explanation":"string","hints":["string","string"]}',
    "Rules:",
    "- Keep meaning unchanged.",
    "- hints must contain between 2 and 4 strings.",
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