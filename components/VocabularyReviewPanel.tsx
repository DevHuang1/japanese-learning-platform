"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";

type Review = {
  id: string;
  incomingJson: string;
  score: number;
  reasonsJson: string;
  source: string;
  createdAt: string;
  candidate: {
    id: string;
    kanji: string | null;
    kana: string;
    burmeseMeaning: string;
  } | null;
};

function parseIncoming(review: Review) {
  try {
    return JSON.parse(review.incomingJson) as {
      kanji?: string;
      kana: string;
      burmese_meaning: string;
    };
  } catch {
    return { kana: "Invalid payload", burmese_meaning: "" };
  }
}

function parseReasons(review: Review): string[] {
  try {
    return JSON.parse(review.reasonsJson) as string[];
  } catch {
    return [];
  }
}

export function VocabularyReviewPanel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/vocabulary/reviews");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to load reviews");
      setReviews(data.reviews ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load reviews");
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

  async function decide(id: string, action: "accept" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/vocabulary/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Failed to update review");
      setReviews((current) => current.filter((review) => review.id !== id));
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "Failed to update review");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-paper-ink/60">
          Fuzzy matches are kept separate until you confirm them.
        </p>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-paper-ink/15 px-3 py-2 text-sm text-indigo-dark hover:bg-paper-deep/50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-crimson/20 bg-crimson/5 px-4 py-3 text-sm text-crimson">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-paper-ink/60">
          <Loader2 size={16} className="animate-spin" /> Loading review queue…
        </div>
      ) : reviews.length === 0 ? (
        <div className="paper-card rounded-2xl p-8 text-center text-sm text-paper-ink/60">
          No pending fuzzy matches.
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const incoming = parseIncoming(review);
            const reasons = parseReasons(review);
            const busy = busyId === review.id;
            return (
              <article key={review.id} className="paper-card rounded-2xl p-5">
                <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-paper-ink/45">Incoming</div>
                    <div className="mt-1 font-jp text-2xl text-indigo-dark">
                      {incoming.kanji ?? incoming.kana}
                    </div>
                    <div className="font-jp text-sm text-paper-ink/70">{incoming.kana}</div>
                    <div className="mt-2 text-sm text-paper-ink/75">{incoming.burmese_meaning}</div>
                  </div>
                  <div className="text-center text-xs font-semibold text-crimson">
                    {Math.round(review.score * 100)}% match
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-paper-ink/45">Existing candidate</div>
                    <div className="mt-1 font-jp text-2xl text-indigo-dark">
                      {review.candidate?.kanji ?? review.candidate?.kana ?? "Deleted candidate"}
                    </div>
                    <div className="font-jp text-sm text-paper-ink/70">{review.candidate?.kana}</div>
                    <div className="mt-2 text-sm text-paper-ink/75">{review.candidate?.burmeseMeaning}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-paper-ink/60">
                  {reasons.map((reason) => (
                    <span key={reason} className="rounded-full bg-paper-deep/70 px-3 py-1">{reason}</span>
                  ))}
                  <span className="rounded-full bg-paper-deep/70 px-3 py-1">Source: {review.source}</span>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => void decide(review.id, "reject")}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg border border-paper-ink/15 px-3 py-2 text-sm text-paper-ink/70 hover:bg-paper-deep/50 disabled:opacity-50"
                  >
                    <X size={15} /> Keep separate
                  </button>
                  <button
                    onClick={() => void decide(review.id, "accept")}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg bg-crimson px-3 py-2 text-sm font-semibold text-paper hover:bg-crimson-soft disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    Accept match
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
