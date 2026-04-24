import { ollamaChat } from "@/lib/llm/ollama";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Direction = "fr-ja" | "ja-fr";

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
    const text = typeof (body as { text?: unknown })?.text === "string"
      ? (body as { text: string }).text.trim()
      : "";
    const direction = (body as { direction?: unknown })?.direction as Direction;

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    if (direction !== "fr-ja" && direction !== "ja-fr") {
      return NextResponse.json(
        { error: "direction must be fr-ja or ja-fr" },
        { status: 400 }
      );
    }

    const instruction =
      direction === "fr-ja"
        ? "Translate from French to Japanese."
        : "Translate from Japanese to French.";
    
    const prompt =
      instruction +
      " Keep the answer concise." +
      " Return only the translated sentence, no explanation." +
      "\n\nInput:\n" +
      text;

    const aiMessage = await ollamaChat.invoke(prompt);
    const translatedText =
      typeof aiMessage.content === "string"
        ? aiMessage.content.trim()
        : String(aiMessage.content);

    return NextResponse.json(
      {
        input: { text, direction },
        output: {
          natural: translatedText,
          literal: "TODO step 2",
          explanation: "TODO step 2",
          hints: [],
        },
        meta: {
          model: process.env.OLLAMA_MODEL ?? "qwen2.5:7b",
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