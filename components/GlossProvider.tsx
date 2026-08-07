"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toHiragana, normalizeKana, simpleRomaji } from "@/lib/japanese";

export interface GlossWord {
  kanji: string | null;
  kana: string;
  romaji: string | null;
  burmeseMeaning: string;
  jlptLevel: string;
}

export interface Token {
  surface_form: string;
  reading?: string;
  pos?: string;
}

interface Tokenizer {
  tokenize: (text: string) => Token[];
}

interface Tooltip {
  token: Token;
  reading: string | null;
  romaji: string;
  word: GlossWord | null;
  x: number;
  y: number;
  w: number;
}

interface GlossContextValue {
  tokenizer: Tokenizer | null;
  map: Map<string, GlossWord>;
  ready: boolean;
  open: (token: Token, rect: { x: number; y: number; w: number }) => void;
  close: () => void;
}

const GlossContext = createContext<GlossContextValue | null>(null);

export function useGloss(): GlossContextValue {
  const ctx = useContext(GlossContext);
  if (!ctx) throw new Error("useGloss must be used within GlossProvider");
  return ctx;
}

let tokenizerPromise: Promise<Tokenizer | null> | null = null;
function ensureTokenizer(): Promise<Tokenizer | null> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve) => {
      import("kuromoji")
        .then((m) => {
          const kuromoji = (m.default ?? m) as {
            builder: (opt: { dicPath: string }) => {
              build: (cb: (err: Error | null, t: Tokenizer) => void) => void;
            };
          };
          kuromoji.builder({ dicPath: "/kuromoji-dict" }).build((err, t) => {
            resolve(err ? null : t);
          });
        })
        .catch(() => resolve(null));
    });
  }
  return tokenizerPromise;
}

let vocabPromise: Promise<Map<string, GlossWord>> | null = null;
function ensureVocab(): Promise<Map<string, GlossWord>> {
  if (!vocabPromise) {
    vocabPromise = fetch("/api/vocabulary/gloss")
      .then((r) => (r.ok ? r.json() : { vocab: [] }))
      .then((data: { vocab?: GlossWord[] }) => {
        const map = new Map<string, GlossWord>();
        for (const w of data.vocab ?? []) {
          const word: GlossWord = {
            kanji: w.kanji,
            kana: w.kana,
            romaji: w.romaji,
            burmeseMeaning: w.burmeseMeaning,
            jlptLevel: w.jlptLevel,
          };
          map.set(normalizeKana(w.kana), word);
          if (w.kanji) map.set(w.kanji, word);
        }
        return map;
      })
      .catch(() => new Map());
  }
  return vocabPromise;
}

export function GlossProvider({ children }: { children: React.ReactNode }) {
  const [tokenizer, setTokenizer] = useState<Tokenizer | null>(null);
  const [map, setMap] = useState<Map<string, GlossWord>>(new Map());
  const [tip, setTip] = useState<Tooltip | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([ensureTokenizer(), ensureVocab()]).then(([t, m]) => {
      if (!active) return;
      setTokenizer(t);
      setMap(m);
    });
    return () => {
      active = false;
    };
  }, []);

  const open = useCallback(
    (token: Token, rect: { x: number; y: number; w: number }) => {
      const reading = token.reading
        ? normalizeKana(toHiragana(token.reading))
        : null;
      const word =
        map.get(token.surface_form) ??
        (reading ? map.get(reading) : undefined);
      const kana = word?.kana ?? reading ?? token.surface_form;
      const romaji = word?.romaji ?? simpleRomaji(kana);
      setTip({
        token,
        reading,
        romaji,
        word: word ?? null,
        x: rect.x,
        y: rect.y,
        w: rect.w,
      });
    },
    [map]
  );

  const close = useCallback(() => setTip(null), []);

  const value = useMemo<GlossContextValue>(
    () => ({ tokenizer, map, ready: tokenizer !== null, open, close }),
    [tokenizer, map, open, close]
  );

  return (
    <GlossContext.Provider value={value}>
      {children}
      {tip && <GlossTooltip tip={tip} />}
    </GlossContext.Provider>
  );
}

function GlossTooltip({ tip }: { tip: Tooltip }) {
  const pos = (() => {
    if (typeof window === "undefined") {
      return { left: tip.x + tip.w / 2, top: tip.y, above: true };
    }
    const left = Math.min(Math.max(tip.x + tip.w / 2, 120), window.innerWidth - 120);
    const above = tip.y > 180;
    return { left, top: above ? tip.y - 10 : tip.y + 14, above };
  })();

  return (
    <div
      className="fixed z-50 w-64 pointer-events-none rounded-xl bg-indigo-dark text-paper p-4 shadow-xl border border-white/10"
      style={{
        left: pos.left,
        top: pos.top,
        transform: pos.above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-jp text-lg leading-none">{tip.token.surface_form}</div>
        {tip.word && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
              tip.word.jlptLevel === "N5"
                ? "bg-crimson/80 text-paper"
                : "bg-white/20 text-paper"
            }`}
          >
            {tip.word.jlptLevel}
          </span>
        )}
      </div>
      {tip.reading && (
        <div className="text-sm text-paper/70 mt-1.5">{tip.reading}</div>
      )}
      <div className="text-sm text-paper/90">{tip.romaji}</div>
      <div className="mt-2 pt-2 border-t border-white/15">
        {tip.word ? (
          <div className="text-mm text-lg leading-snug">
            {tip.word.burmeseMeaning}
          </div>
        ) : (
          <div className="text-xs text-paper/60">
            No Burmese translation yet
          </div>
        )}
      </div>
    </div>
  );
}
