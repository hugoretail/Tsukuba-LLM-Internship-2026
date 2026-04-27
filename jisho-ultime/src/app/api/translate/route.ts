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
    const messages = buildTranslationMessages({ text, direction });
    const aiMessage = await ollamaChat.invoke(messages);
    const rawContent =
      typeof aiMessage.content === "string"
        ? aiMessage.content.trim()
        : JSON.stringify(aiMessage.content);

    const parsedJson = parseModelJson(rawContent);
    if (!parsedJson) {
      return NextResponse.json(
        {
          error: "invalid model output",
          details: "Could not parse JSON object from model response",
          raw: rawContent.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const parsedOutput = translateLlmOutputSchema.safeParse(parsedJson);
    if (!parsedOutput.success) {
      return NextResponse.json(
        {
          error: "schema validation failed",
          details: parsedOutput.error.flatten(),
          raw: rawContent.slice(0, 500),
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        input: { text, direction },
        output: parsedOutput.data,
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