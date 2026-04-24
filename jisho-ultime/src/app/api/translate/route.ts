import { NextRequest, NextResponse } from "next/server";

type Direction = "fr-ja" | "ja-fr";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const direction = body?.direction as Direction;

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

    const mockResponse = {
      input: { text, direction },
      output: {
        natural:
          direction === "fr-ja"
            ? "これは自然な翻訳のモックです。"
            : "Ceci est une traduction naturelle mockee.",
        literal:
          direction === "fr-ja"
            ? "これは直訳のモックです。"
            : "Ceci est une traduction litterale mockee.",
        explanation:
          "Mock: explication courte des choix lexicaux et grammaticaux.",
        hints: [
          "Mock hint 1",
          "Mock hint 2",
        ],
      },
      meta: {
        model: "mock-model",
        latencyMs: 42,
      },
    };
    return NextResponse.json(mockResponse, { status: 200 });
  } catch {
    return  NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 }
    );
  }
}