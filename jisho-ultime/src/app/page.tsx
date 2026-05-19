"use client";

import { type UILang, t } from "@/lib/i18n";
import { useEffect, useState } from "react";

type Direction = "fr-ja" | "ja-fr";

type AnnotationToken = {
  display: string;
  surface: string;
  gloss: string;
  equivalents: string[];
  antonyms?: string[];
  lemma?: string;
  pos?: string;
  notes?: string;
  start?: number;
  end?: number;
};

type GrammarPoint = {
  name: string;
  explanation: string;
  line: number;
  token_span?: [number, number];
  example?: string;
};

type TranslateResponse = {
  input: { text: string; direction: Direction };
  output: {
    translation: string;
    explanation: string;
    hints: string[];
    annotations: AnnotationToken[][];
    grammar: GrammarPoint[];
  };
  meta: {
    model: string;
    latencyMs: number;
  };
};

type HistoryItem = {
  text: string;
  direction: Direction;
  output: TranslateResponse["output"];
  timestamp: string;
};

type HoverCard = {
  title: string;
  lines: string[];
  x: number;
  y: number;
};

const HISTORY_STORAGE_KEY = "jisho-ultime-history";

function getGrammarPointsForToken(
  grammar: GrammarPoint[],
  lineIndex: number,
  tokenIndex: number
) {
  return grammar.filter((point) => {
    if (point.line !== lineIndex || !point.token_span) {
      return false;
    }

    const [start, end] = point.token_span;
    return tokenIndex >= start && tokenIndex < end;
  });
}

function isLikelyTargetLanguage(text: string, direction: Direction) {
  if (direction === "fr-ja") {
    return /[\u3040-\u30ff\u4e00-\u9faf]/u.test(text);
  }

  return /[A-Za-zÀ-ÖØ-öø-ÿ]/u.test(text);
}

function canRenderAnnotationLine(
  annotationLine: AnnotationToken[],
  naturalLine: string,
  direction: Direction
) {
  if (annotationLine.length === 0) {
    return false;
  }

  const reconstructed = annotationLine.map((token) => token.display).join("");
  if (!reconstructed.trim()) {
    return false;
  }

  const normalizedReconstructed = reconstructed.replace(/\s+/gu, "");
  const normalizedNatural = naturalLine.replace(/\s+/gu, "");
  if (normalizedReconstructed !== normalizedNatural) {
    return false;
  }

  return isLikelyTargetLanguage(reconstructed, direction) || !isLikelyTargetLanguage(naturalLine, direction);
}

function buildTokenHoverCard(
  token: AnnotationToken,
  x: number,
  y: number,
  relatedGrammar: GrammarPoint[],
  uiLang: UILang
): HoverCard {
  const lines = [
    `${t(uiLang, "directTranslation")}: ${token.gloss}`,
    token.equivalents.length > 0
      ? `${t(uiLang, "equivalents")}: ${token.equivalents.join(", ")}`
      : null,
    token.lemma ? `${t(uiLang, "lemma")}: ${token.lemma}` : null,
    token.pos ? `${t(uiLang, "pos")}: ${token.pos}` : null,
     token.notes ? `${t(uiLang, "notes")}: ${token.notes}` : null,
     token.antonyms && token.antonyms.length > 0
       ? `${t(uiLang, "antonyms")}: ${token.antonyms.join(", ")}`
       : null,
    relatedGrammar.length > 0
      ? `${t(uiLang, "linkedGrammar")}: ${relatedGrammar.map((point) => point.name).join(", ")}`
      : null,
  ].filter((line): line is string => line !== null);

  return {
    title: token.surface,
    lines,
    x,
    y,
  };
}

function buildGrammarHoverCard(
  point: GrammarPoint,
  x: number,
  y: number,
  uiLang: UILang
): HoverCard {
  const lines = [
    `${t(uiLang, "grammarExplanation")}: ${point.explanation}`,
    point.example ? `${t(uiLang, "grammarExample")}: ${point.example}` : null,
  ].filter((line): line is string => line !== null);

  return {
    title: point.name,
    lines,
    x,
    y,
  };
}

export default function Home() {
  const [text, setText] = useState("Bonjour, comment vas-tu ?");
  const [direction, setDirection] = useState<Direction>("fr-ja");
  const [uiLang, setUiLang] = useState<UILang>("ja");
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hoverCard, setHoverCard] = useState<HoverCard | null>(null);
  const [usePivotEnglish, setUsePivotEnglish] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Set UI language based on browser locale. Fallback to Japanese.
    // Put setState in a microtask to avoid cascading renders warning.
    setTimeout(() => {
      try {
        const nav = navigator.language || (navigator.languages && navigator.languages[0]) || "";
        if (nav && nav.toLowerCase().startsWith("fr")) {
          setUiLang("fr");
        } else {
          setUiLang("ja");
        }
      } catch {
        // ignore
      }
    }, 0);

    try {
      const storedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!storedHistory) {
        return;
      }

      // Delay state sync to avoid hydration mismatch between SSR and client localStorage state.
      setTimeout(() => {
        setHistory(JSON.parse(storedHistory) as HistoryItem[]);
      }, 0);
    } catch {
      // Ignore invalid localStorage payloads.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  async function handleTranslate() {
    const trimmedText = text.trim();

    if (!trimmedText) {
      setError(t(uiLang, "errorEmpty"));
      return;
    }

    setLoading(true);
    setError(null);
    setHoverCard(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: trimmedText, direction, uiLang, usePivotEnglish }),
      });

      const rawBody = await response.text();
      let data: TranslateResponse | { error?: string } | null = null;

      if ((response.headers.get("content-type") ?? "").includes("application/json")) {
        try {
          data = JSON.parse(rawBody) as TranslateResponse | { error?: string };
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        if (data && "error" in data) {
          throw new Error(data.error ?? t(uiLang, "errorUnknown"));
        }

        throw new Error(t(uiLang, "errorUnknown"));
      }

      if (!data || !("output" in data)) {
        throw new Error(t(uiLang, "errorUnknown"));
      }

      const translation = data as TranslateResponse;
      setResult(translation);
      setShowDetails(false);

      setHistory((currentHistory) => [
        {
          text: trimmedText,
          direction,
          output: translation.output,
          timestamp: new Date().toISOString(),
        },
        ...currentHistory,
      ].slice(0, 10));
    } catch (translateError) {
      setError(
        translateError instanceof Error
          ? translateError.message
          : t(uiLang, "errorTranslate")
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleToggleDirection() {
    const newDirection: Direction = direction === "fr-ja" ? "ja-fr" : "fr-ja";
    // Update default text based on new direction
    if (newDirection === "fr-ja") {
      setText("Bonjour, comment vas-tu ?");
    } else {
      setText("こんにちは、元気ですか?");
    }
    // Reset UI state
    setResult(null);
    setError(null);
    setHoverCard(null);
    setShowDetails(false);
    setDirection(newDirection);
  }

  const translatedLines = result?.output.translation.split(/\r?\n/u) ?? [];

  return (
    <div className="min-h-screen bg-[#f5f2eb] text-[#1f2937]">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-lg tracking-[0.2em]">{t(uiLang, "appTitle")}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 rounded-full border border-[#ddd6c7] bg-white p-1">
              <button
                type="button"
                onClick={() => setUiLang("fr")}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  uiLang === "fr"
                    ? "bg-[#1f2937] text-white"
                    : "text-[#6b7280] hover:bg-[#f3f4f6]"
                }`}
              >
                {t("fr", "langFR")}
              </button>
              <button
                type="button"
                onClick={() => setUiLang("ja")}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  uiLang === "ja"
                    ? "bg-[#1f2937] text-white"
                    : "text-[#6b7280] hover:bg-[#f3f4f6]"
                }`}
              >
                {t("ja", "langJA")}
              </button>
            </div>
            <div className="group relative text-xs text-[#6b7280]">
              ?
              <span className="pointer-events-none absolute -right-1 top-6 w-48 rounded-md border border-[#d4cec2] bg-[#fffdf9] px-2 py-1 text-[11px] leading-5 opacity-0 shadow-sm transition group-hover:opacity-100">
                {t(uiLang, "appHint")}
              </span>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-[#ddd6c7] bg-[#fffdf9] p-3 sm:p-4">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-40 w-full resize-y rounded-xl border border-[#e5dfd2] bg-white px-4 py-3 text-base leading-7 outline-none transition focus:border-[#9ca3af]"
            placeholder={t(uiLang, "placeholder")}
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-0 rounded-full border border-[#ddd6c7] bg-white p-1">
              <span className="px-3 py-1.5 text-xs font-medium text-[#374151]">
                FR
              </span>
              <button
                type="button"
                onClick={handleToggleDirection}
                className="border-l border-r border-[#ddd6c7] px-2 py-1.5 text-base text-[#6b7280] transition hover:text-[#374151]"
                title={direction === "fr-ja" ? t(uiLang, "dirFrJa") : t(uiLang, "dirJaFr")}
              >
                {direction === "fr-ja" ? "→" : "←"}
              </button>
              <span className="px-3 py-1.5 text-xs font-medium text-[#374151]">
                JA
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[#6b7280]">
                <input
                  type="checkbox"
                  checked={usePivotEnglish}
                  onChange={(e) => setUsePivotEnglish(e.target.checked)}
                />
                <span>{t(uiLang, "usePivotEnglish")}</span>
              </label>

              <button
                type="button"
                onClick={handleTranslate}
                disabled={loading}
                className="rounded-full border border-[#d1d5db] bg-[#1f2937] px-4 py-2 text-sm text-white transition hover:bg-[#111827] disabled:cursor-not-allowed disabled:bg-[#9ca3af]"
              >
                {loading ? t(uiLang, "loading") : t(uiLang, "translateBtn")}
              </button>
            </div>
          </div>

          {error ? (
            <p className="mt-2 text-xs text-[#b91c1c]">{error}</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[#ddd6c7] bg-[#fffdf9] p-3 sm:p-4">
          <div className="space-y-2">
            {result ? (
              translatedLines.map((line, lineIndex) => {
                const annotationLine = result.output.annotations?.[lineIndex] ?? [];
                const useAnnotationLine = canRenderAnnotationLine(
                  annotationLine,
                  line,
                  direction
                );

                if (useAnnotationLine) {
                  return (
                    <p
                      key={`${lineIndex}-${line}`}
                      className="whitespace-pre-wrap text-lg leading-8 text-[#111827]"
                    >
                      {annotationLine.map((token, tokenIndex) => {
                        const relatedGrammar = getGrammarPointsForToken(
                          result.output.grammar,
                          lineIndex,
                          tokenIndex
                        );
                        const highlighted = relatedGrammar.length > 0 && relatedGrammar.some((g) => g.token_span);

                        return (
                          <span
                            key={`${lineIndex}-${tokenIndex}-${token.surface}`}
                            className={`cursor-help rounded px-0.5 transition ${
                              highlighted
                                ? "bg-amber-100 underline decoration-dotted underline-offset-4"
                                : "hover:bg-[#f3f4f6]"
                            }`}
                            onMouseEnter={(event) => {
                              setHoverCard(
                                buildTokenHoverCard(
                                  token,
                                  event.clientX,
                                  event.clientY,
                                  relatedGrammar,
                                  uiLang
                                )
                              );
                            }}
                            onMouseLeave={() => setHoverCard(null)}
                          >
                            {token.display}
                          </span>
                        );
                      })}
                    </p>
                  );
                }

                return (
                  <p
                    key={`${lineIndex}-${line}`}
                    className="whitespace-pre-wrap text-lg leading-8 text-[#111827]"
                  >
                    {line}
                  </p>
                );
              })
            ) : (
              <p className="whitespace-pre-line text-lg leading-8 text-[#111827]">
                ...
              </p>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDetails((current) => !current)}
              className="text-xs text-[#6b7280] underline-offset-2 hover:underline"
            >
              {showDetails ? t(uiLang, "hideDetails") : t(uiLang, "showDetails")}
            </button>
            {result ? (
              <span className="text-xs text-[#9ca3af]">{result.meta.latencyMs}{t(uiLang, "ms")}</span>
            ) : null}
          </div>

          {result?.output.grammar?.length ? (
            <div className="mt-3 rounded-xl border border-[#ebe6db] bg-[#faf8f3] p-3">
              <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-[#9ca3af]">
                {t(uiLang, "grammarPoints")}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.output.grammar.map((point, index) => (
                  <button
                    key={`${point.name}-${index}`}
                    type="button"
                    className="rounded-full border border-[#ddd6c7] bg-white px-3 py-1 text-xs text-[#374151] transition hover:bg-[#f8fafc]"
                    onMouseEnter={(event) => {
                      setHoverCard(
                        buildGrammarHoverCard(point, event.clientX, event.clientY, uiLang)
                      );
                    }}
                    onMouseLeave={() => setHoverCard(null)}
                  >
                    {point.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {showDetails ? (
            <div className="mt-3 grid gap-3 rounded-xl border border-[#ebe6db] bg-[#faf8f3] p-3 text-sm">
              <DetailRow
                label={t(uiLang, "hints")}
                value={result?.output.hints?.length ? result.output.hints.join("\n") : "..."}
              />
            </div>
          ) : null}
        </section>

        {hoverCard ? (
          <div
            className="fixed z-30 max-w-xs rounded-2xl border border-[#d9d2c3] bg-[#fffdf9] px-3 py-2 text-xs text-[#374151] shadow-lg"
            style={{
              left: hoverCard.x + 12,
              top: hoverCard.y + 12,
            }}
          >
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#9ca3af]">
              {hoverCard.title}
            </p>
            <div className="space-y-1 leading-5">
              {hoverCard.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        ) : null}
      </main>

      <div className="pointer-events-none fixed bottom-4 right-4 z-20 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setShowHistory((current) => !current)}
          className="pointer-events-auto rounded-full border border-[#d1d5db] bg-[#fffdf9] px-3 py-2 text-xs text-[#374151] shadow-sm"
          title={t(uiLang, "history")}
        >
          {t(uiLang, "history")} ({history.length})
        </button>
      </div>

      <aside
        className={`fixed inset-x-0 bottom-0 z-10 border-t border-[#d9d2c3] bg-[#fffdf9] shadow-[0_-8px_24px_rgba(17,24,39,0.08)] transition-transform duration-300 ${
          showHistory ? "translate-y-0" : "translate-y-[calc(100%-2.6rem)]"
        }`}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => setShowHistory((current) => !current)}
            className="text-xs text-[#6b7280]"
          >
            {showHistory ? "close" : "open"}
          </button>
          <span className="text-xs text-[#9ca3af]">{t(uiLang, "history")}</span>
        </div>

        <div className="mx-auto max-h-56 w-full max-w-3xl overflow-y-auto px-4 pb-4 sm:px-6">
          {history.length === 0 ? (
            <p className="text-xs text-[#9ca3af]">...</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <article
                  key={`${item.timestamp}-${item.text}`}
                  className="rounded-xl border border-[#ebe6db] bg-white px-3 py-2"
                >
                  <div className="mb-1 flex items-center justify-between text-[11px] text-[#9ca3af]">
                    <span>{item.direction === "fr-ja" ? t(uiLang, "dirFrJa") : t(uiLang, "dirJaFr")}</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString(uiLang === "fr" ? "fr-FR" : "ja-JP")}</span>
                  </div>
                  <p className="line-clamp-1 text-xs text-[#6b7280]">{item.text}</p>
                  <p className="line-clamp-1 text-sm text-[#111827]">{item.output.translation}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-[#9ca3af]">{label}</p>
      <p className="whitespace-pre-line text-sm leading-6 text-[#374151]">{value}</p>
    </div>
  );
}
