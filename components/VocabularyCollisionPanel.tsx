"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";

type CollisionRow = {
  id: string;
  canonicalKey: string | null;
  kanji: string | null;
  kana: string;
  burmeseMeaning: string;
  jlptLevel: string;
  pdfSource: string | null;
  progress: { id: string; status: string; repetitions: number } | null;
};

type Collision = {
  canonicalKey: string;
  rows: CollisionRow[];
};

export function VocabularyCollisionPanel() {
  const [collisions, setCollisions] = useState<Collision[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/vocabulary/collisions");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to load collisions");
      setCollisions(data.collisions ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load collisions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function keepRow(collision: Collision, targetId: string) {
    setBusyKey(collision.canonicalKey);
    setError(null);
    try {
      for (const row of collision.rows) {
        if (row.id === targetId) continue;
        const response = await fetch("/api/vocabulary/collisions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId: row.id, targetId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Failed to resolve collision");
      }
      await load();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Failed to resolve collision");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section aria-labelledby="collision-heading" className="mt-10 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="collision-heading" className="text-xl font-semibold text-indigo-dark">
            Duplicate collision groups
          </h2>
          <p className="mt-1 text-sm text-paper-ink/60">
            These rows share the same normalized identity. Choose the row to keep; progress and review links are preserved.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || busyKey !== null}
          aria-label="Refresh duplicate collision groups"
          className="inline-flex items-center gap-2 rounded-lg border border-paper-ink/15 px-3 py-2 text-sm text-indigo-dark hover:bg-paper-deep/50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-crimson/20 bg-crimson/5 px-4 py-3 text-sm text-crimson">
          {error}
        </div>
      )}

      {loading ? (
        <div role="status" className="flex items-center gap-2 text-sm text-paper-ink/60">
          <Loader2 size={16} className="animate-spin" /> Checking duplicate groups…
        </div>
      ) : collisions.length === 0 ? (
        <div className="paper-card rounded-2xl p-6 text-sm text-paper-ink/60">
          No duplicate collision groups detected.
        </div>
      ) : (
        collisions.map((collision) => (
          <article
            key={collision.canonicalKey}
            aria-labelledby={`collision-${collision.canonicalKey}`}
            className="paper-card rounded-2xl border border-amber-200 bg-amber-50/40 p-5"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1">
                <h3 id={`collision-${collision.canonicalKey}`} className="font-semibold text-indigo-dark">
                  Identity collision
                </h3>
                <code className="mt-1 block break-all text-xs text-paper-ink/60">{collision.canonicalKey}</code>
                <ul className="mt-4 space-y-3" aria-label="Colliding vocabulary rows">
                  {collision.rows.map((row) => (
                    <li key={row.id} className="rounded-xl border border-paper-ink/10 bg-paper/70 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-jp text-lg text-indigo-dark">{row.kanji ?? row.kana}</div>
                          <div className="font-jp text-sm text-paper-ink/70">{row.kana}</div>
                          <div className="mt-1 text-sm text-paper-ink/75">{row.burmeseMeaning}</div>
                          <div className="mt-1 text-xs text-paper-ink/50">
                            {row.pdfSource ?? "manual"} · {row.progress ? `${row.progress.repetitions} reviews` : "no progress"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void keepRow(collision, row.id)}
                          disabled={busyKey !== null}
                          aria-label={`Keep ${row.kanji ?? row.kana} ${row.kana} and remove other duplicates`}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-dark px-3 py-2 text-sm font-semibold text-paper hover:bg-indigo-dark/90 disabled:opacity-50"
                        >
                          {busyKey === collision.canonicalKey ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                          Keep this row
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
