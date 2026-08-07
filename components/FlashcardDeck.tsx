"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Volume2, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { RATINGS, type Rating } from "@/lib/sm2";

export interface FlashcardData {
  vocabId: string;
  kanji: string | null;
  kana: string;
  romaji: string | null;
  burmeseMeaning: string;
  exampleSentenceJp: string | null;
  exampleSentenceMm: string | null;
  jlptLevel: string;
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 0.85;
  const voices = window.speechSynthesis.getVoices();
  const jp = voices.find((v) => v.lang.startsWith("ja"));
  if (jp) u.voice = jp;
  window.speechSynthesis.speak(u);
}

export function FlashcardDeck({ initialCards }: { initialCards: FlashcardData[] }) {
  const [deck, setDeck] = useState<FlashcardData[]>(initialCards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const card = deck[index];

  const advance = useCallback(() => {
    setFlipped(false);
    setMessage(null);
    if (deck.length <= 1) {
      setIndex(0);
      return;
    }
    setIndex((i) => (i + 1) % deck.length);
  }, [deck.length]);

  const rate = useCallback(
    async (grade: Rating) => {
      if (!card || busy) return;
      setBusy(true);
      try {
        const res = await fetch("/api/flashcards/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vocabId: card.vocabId, rating: grade }),
        });
        if (!res.ok) throw new Error("rate failed");
        const data = await res.json();
        const label = RATINGS.find((r) => r.value === grade)?.label ?? "Rated";
        const nextIn =
          grade === 0
            ? "today"
            : grade === 3
              ? `${data.next.interval ?? 1}d`
              : `${data.next.interval ?? 1}d`;
        setMessage(`${label} — next review in ${nextIn}`);
        if (deck.length > 1) {
          setDeck((d) => d.filter((_, i) => i !== index));
        }
        setTimeout(advance, 400);
      } catch {
        setMessage("Rating failed. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [card, busy, deck.length, index, advance]
  );

  if (!card) {
    return (
      <div className="paper-card rounded-2xl p-12 text-center">
        <CheckCircle2 className="mx-auto text-crimson mb-4" size={40} />
        <h2 className="font-jp text-xl text-indigo-dark mb-2">今日の学習は終わりです</h2>
        <p className="text-paper-ink/70">All due cards reviewed. Great work!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center text-sm text-paper-ink/60 mb-3">
          <span className="flex items-center gap-1.5">
            <ChevronLeft size={14} /> {index + 1} / {deck.length}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              card.jlptLevel === "N5"
                ? "bg-crimson/10 text-crimson"
                : "bg-indigo-dark/10 text-indigo-dark"
            }`}
          >
            JLPT {card.jlptLevel}
          </span>
        </div>

        <div className="relative h-80 perspective-1000" onClick={() => setFlipped((f) => !f)}>
          <motion.div
            className="absolute inset-0 preserve-3d cursor-pointer"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Front */}
            <div
              className="paper-card absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-4 backface-hidden"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="text-[13px] tracking-[0.3em] text-paper-ink/40 uppercase">
                Tap to reveal
              </div>
              <div className="font-jp text-5xl text-indigo-dark leading-tight text-center px-6">
                {card.kanji ?? card.kana}
              </div>
              {card.kanji && (
                <div className="text-jp text-xl text-paper-ink/70">{card.kana}</div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  speak(card.kana);
                }}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-dark/5 text-indigo-dark hover:bg-indigo-dark/10 transition-colors"
              >
                <Volume2 size={18} /> {card.romaji ?? ""}
              </button>
            </div>

            {/* Back */}
            <div
              className="paper-card absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3 backface-hidden bg-paper"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <div className="text-mm text-4xl text-indigo-dark text-center px-6 leading-snug">
                {card.burmeseMeaning}
              </div>
              <div className="text-sm text-paper-ink/60">
                {card.kanji ?? ""} · {card.kana} · {card.romaji}
              </div>
              {card.exampleSentenceJp && (
                <div className="mt-3 px-6 text-jp text-indigo-mid text-center leading-relaxed">
                  {card.exampleSentenceJp}
                </div>
              )}
              {card.exampleSentenceMm && (
                <div className="px-6 text-mm text-paper-ink/60 text-center text-sm">
                  {card.exampleSentenceMm}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {message && (
          <div className="text-center mt-3 text-sm text-crimson font-medium animate-pulse">
            {message}
          </div>
        )}

        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 grid grid-cols-4 gap-2"
          >
            {RATINGS.map((r) => (
              <button
                key={r.value}
                disabled={busy}
                onClick={() => rate(r.value)}
                className="py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 bg-paper-card border border-ink-line hover:-translate-y-0.5 hover:shadow-md text-paper-ink"
              >
                {r.label}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setIndex((i) => (i - 1 + deck.length) % deck.length)}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-indigo-dark/5 hover:bg-indigo-dark/10 text-sm"
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <span className="text-xs text-paper-ink/50">Click card to flip</span>
        <button
          onClick={() => setIndex((i) => (i + 1) % deck.length)}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-indigo-dark/5 hover:bg-indigo-dark/10 text-sm"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
