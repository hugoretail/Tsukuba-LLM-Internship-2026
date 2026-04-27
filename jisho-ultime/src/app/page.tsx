"use client";

import { useEffect, useState } from "react";

type Direction = "fr-ja" | "ja-fr";

type TranslateResponse = {
  input: { text: string; direction: Direction };
  output: {
    natural: string;
    literal: string;
    explanation: string;
    hints: string[];
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

const HISTORY_STORAGE_KEY = "jisho-ultime-history";

export default function Home() {
  const [text, setText] = useState("Bonjour, comment vas-tu ?");
  const [direction, setDirection] = useState<Direction>("fr-ja");
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

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
      setError("Entre un texte a traduire.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: trimmedText, direction }),
      });

      const data = (await response.json()) as
        | TranslateResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error ?? "Erreur inconnue" : "Erreur inconnue");
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
          : "Impossible de contacter l'API de traduction."
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f2eb] text-[#1f2937]">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-lg tracking-[0.2em]">JISHO</h1>
          <div className="group relative text-xs text-[#6b7280]">
            ?
            <span className="pointer-events-none absolute -right-1 top-6 w-48 rounded-md border border-[#d4cec2] bg-[#fffdf9] px-2 py-1 text-[11px] leading-5 opacity-0 shadow-sm transition group-hover:opacity-100">
              Translate FR/JA. Click details only if needed.
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-[#ddd6c7] bg-[#fffdf9] p-3 sm:p-4">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-40 w-full resize-y rounded-xl border border-[#e5dfd2] bg-white px-4 py-3 text-base leading-7 outline-none transition focus:border-[#9ca3af]"
            placeholder="Type..."
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full border border-[#ddd6c7] bg-white p-1">
              <SwitchButton
                active={direction === "fr-ja"}
                onClick={() => setDirection("fr-ja")}
                label="FR -> JA"
                title="French vers Japanese"
              />
              <SwitchButton
                active={direction === "ja-fr"}
                onClick={() => setDirection("ja-fr")}
                label="JA -> FR"
                title="Japanese vers French"
              />
            </div>

            <button
              type="button"
              onClick={handleTranslate}
              disabled={loading}
              className="rounded-full border border-[#d1d5db] bg-[#1f2937] px-4 py-2 text-sm text-white transition hover:bg-[#111827] disabled:cursor-not-allowed disabled:bg-[#9ca3af]"
            >
              {loading ? "..." : "Go"}
            </button>
          </div>

          {error ? (
            <p className="mt-2 text-xs text-[#b91c1c]">{error}</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[#ddd6c7] bg-[#fffdf9] p-3 sm:p-4">
          <p className="whitespace-pre-line text-lg leading-8 text-[#111827]">
            {result?.output.natural ?? "..."}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDetails((current) => !current)}
              className="text-xs text-[#6b7280] underline-offset-2 hover:underline"
            >
              {showDetails ? "hide details" : "show details"}
            </button>
            {result ? (
              <span className="text-xs text-[#9ca3af]">{result.meta.latencyMs}ms</span>
            ) : null}
          </div>

          {showDetails ? (
            <div className="mt-3 grid gap-3 rounded-xl border border-[#ebe6db] bg-[#faf8f3] p-3 text-sm">
              <DetailRow label="literal" value={result?.output.literal ?? "..."} />
              <DetailRow label="explanation" value={result?.output.explanation ?? "..."} />
              <DetailRow
                label="hints"
                value={result?.output.hints?.length ? result.output.hints.join("\n") : "..."}
              />
            </div>
          ) : null}
        </section>
      </main>

      <div className="pointer-events-none fixed bottom-4 right-4 z-20 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setShowHistory((current) => !current)}
          className="pointer-events-auto rounded-full border border-[#d1d5db] bg-[#fffdf9] px-3 py-2 text-xs text-[#374151] shadow-sm"
          title="Toggle history"
        >
          history ({history.length})
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
          <span className="text-xs text-[#9ca3af]">history</span>
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
                    <span>{item.direction === "fr-ja" ? "FR -> JA" : "JA -> FR"}</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString("fr-FR")}</span>
                  </div>
                  <p className="line-clamp-1 text-xs text-[#6b7280]">{item.text}</p>
                  <p className="line-clamp-1 text-sm text-[#111827]">{item.output.natural}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function SwitchButton({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-full px-3 py-1.5 text-xs transition ${
        active
          ? "bg-[#1f2937] text-white"
          : "text-[#6b7280] hover:bg-[#f3f4f6]"
      }`}
    >
      {label}
    </button>
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
