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
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const storedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      return storedHistory ? (JSON.parse(storedHistory) as HistoryItem[]) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-10">
        <section className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Jisho Ultime
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            FR <span className="text-emerald-300">&lt;-&gt;</span> JA Learning Assistant
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
            Test de la route mock /api/translate avec une interface minimale en React / Next.js.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-zinc-200">
                Texte source
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  className="mt-2 min-h-40 w-full rounded-2xl border border-white/10 bg-zinc-900/90 p-4 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-emerald-400"
                  placeholder="Saisis une phrase en français ou en japonais..."
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="block text-sm font-medium text-zinc-200">
                  Direction
                  <select
                    value={direction}
                    onChange={(event) => setDirection(event.target.value as Direction)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 sm:w-56"
                  >
                    <option value="fr-ja">FR vers JA</option>
                    <option value="ja-fr">JA vers FR</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                >
                  {loading ? "Traduction..." : "Traduire"}
                </button>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Sorties</p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-50">Réponse mockée</h2>
              </div>

              <OutputCard title="Traduction naturelle" value={result?.output.natural ?? "En attente..."} />
              <OutputCard title="Traduction littérale" value={result?.output.literal ?? "En attente..."} />
              <OutputCard title="Explication courte" value={result?.output.explanation ?? "En attente..."} />
              <OutputCard
                title="Grammar hints"
                value={result?.output.hints?.length ? result.output.hints.join("\n") : "En attente..."}
              />

              {result ? (
                <p className="text-xs text-zinc-400">
                  Modèle: {result.meta.model} • latence: {result.meta.latencyMs} ms
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Historique</p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-50">Dernières requêtes</h2>
            </div>
            <p className="text-sm text-zinc-400">{history.length} élément(s)</p>
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-zinc-400">Aucune requête pour le moment.</p>
          ) : (
            <div className="grid gap-3">
              {history.map((item) => (
                <article
                  key={`${item.timestamp}-${item.text}`}
                  className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-zinc-100">
                      {item.direction === "fr-ja" ? "FR -> JA" : "JA -> FR"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {new Date(item.timestamp).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-zinc-300">{item.text}</p>
                  <p className="mt-3 text-sm text-emerald-300">{item.output.natural}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function OutputCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">{title}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-100">{value}</p>
    </div>
  );
}
