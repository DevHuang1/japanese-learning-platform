"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Loader2, BookmarkCheck, Languages } from "lucide-react";
import { toHiragana, normalizeKana } from "@/lib/japanese";

export interface ReaderVocab {
  id: string;
  kanji: string | null;
  kana: string;
  romaji: string | null;
  burmeseMeaning: string;
  jlptLevel: string;
}

interface Token {
  surface_form: string;
  reading?: string;
  basic_form?: string;
  pos?: string;
}

interface Kuromoji {
  builder: (opt: { dicPath: string }) => {
    build: (cb: (err: Error | null, tokenizer: Tokenizer) => void) => void;
  };
}
interface Tokenizer {
  tokenize: (text: string) => Token[];
}

const SAMPLE_TEXTS = [
  {
    label: "自己紹介",
    text: "こんにちは。私はミャンマーから来ました。日本語の勉強が大好きです。友達と一緒に学校へ行きます。先生はとても優しいです。将来は日本に行きたいです。毎日日本語を勉強します。",
  },
  {
    label: "日常",
    text: "朝、水を飲みます。それから電車で学校に行きます。昼ごはんを食べます。夜、音楽を聞きます。新しい友達と話します。高い山を見ました。",
  },
  {
    label: "Grammar note",
    text: "この問題は難しいです。しかし、勉強すればわかります。世界のニュースを見ます。駅で友達に会いました。授業は九時から始まります。",
  },
];

export function InteractiveReader({ vocab }: { vocab: ReaderVocab[] }) {
  const [tokenizer, setTokenizer] = useState<Tokenizer | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(SAMPLE_TEXTS[0].text);
  const [pinned, setPinned] = useState<{
    token: Token;
    match: ReaderVocab | null;
    x: number;
    y: number;
  } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const lookup = useMemo(() => {
    const map = new Map<string, ReaderVocab[]>();
    for (const v of vocab) {
      const key = normalizeKana(v.kana);
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
      if (v.kanji) {
        const k = map.get(v.kanji) ?? [];
        k.push(v);
        map.set(v.kanji, k);
      }
    }
    return map;
  }, [vocab]);

  useEffect(() => {
    let cancelled = false;
    import("kuromoji")
      .then((m) => {
        const kuromoji = (m.default ?? m) as unknown as Kuromoji;
        kuromoji.builder({ dicPath: "/kuromoji-dict" }).build((err, t) => {
          if (cancelled || err) {
            setLoading(false);
            if (err) console.error("kuromoji error", err);
            return;
          }
          setTokenizer(t);
          setLoading(false);
        });
      })
      .catch((e) => {
        setLoading(false);
        console.error(e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tokens = useMemo(
    () => (tokenizer ? tokenizer.tokenize(text) : []),
    [tokenizer, text]
  );

  const showTooltip = useCallback(
    (token: Token, e: React.MouseEvent<HTMLElement>) => {
      const surface = token.surface_form;
      const reading = token.reading ? normalizeKana(toHiragana(token.reading)) : null;
      const match =
        lookup.get(surface)?.[0] ?? (reading ? lookup.get(reading)?.[0] : null);
      const rect = e.currentTarget.getBoundingClientRect();
      setPinned({
        token,
        match: match ?? null,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    },
    [lookup]
  );

  const addToDeck = useCallback(
    async (token: Token) => {
      const reading = token.reading ? normalizeKana(toHiragana(token.reading)) : null;
      const surface = token.surface_form;
      setAdding(surface);
      try {
        const res = await fetch("/api/vocabulary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kanji: /[\u4e00-\u9fff]/.test(surface) ? surface : null,
            kana: reading ?? surface,
            burmeseMeaning: "（未翻訳）",
            jlptLevel: "N5",
            partOfSpeech: token.pos ?? "不明",
          }),
        });
        const data = await res.json();
        setToast(
          res.ok ? `Added "${surface}" to your deck.` : data?.error ?? "Failed to add."
        );
        setPinned(null);
      } catch {
        setToast("Failed to add word.");
      } finally {
        setAdding(null);
        setTimeout(() => setToast(null), 2600);
      }
    },
    []
  );

  const renderText = () => {
    let key = 0;
    const parts: React.ReactNode[] = [];
    for (const token of tokens) {
      const surface = token.surface_form;
      const isMatch = lookup.has(surface) || (token.reading ? lookup.has(normalizeKana(toHiragana(token.reading))) : false);
      parts.push(
        <span
          key={key++}
          onMouseEnter={(e) => showTooltip(token, e)}
          onClick={(e) => showTooltip(token, e)}
          className={
            isMatch
              ? "cursor-pointer rounded px-0.5 -mx-0.5 transition-colors hover:bg-crimson/10 hover:underline decoration-crimson/40 underline-offset-2"
              : "text-paper-ink"
          }
        >
          {surface}
        </span>
      );
    }
    return parts;
  };

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-4">
        <div className="paper-card rounded-2xl p-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-paper-ink/50 mb-2">
            Japanese text — hover or tap words for Burmese glosses
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full font-jp text-lg leading-relaxed bg-transparent outline-none resize-y text-indigo-dark"
            placeholder="Paste Japanese text here…"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {SAMPLE_TEXTS.map((s) => (
              <button
                key={s.label}
                onClick={() => setText(s.text)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  text === s.text
                    ? "bg-crimson text-paper border-crimson"
                    : "bg-paper-card border-ink-line text-paper-ink/70 hover:text-crimson"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="paper-card rounded-2xl p-6 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-56 text-paper-ink/50">
              <Loader2 className="animate-spin mr-2" size={18} />
              Loading Japanese tokenizer…
            </div>
          ) : (
            <div className="font-jp text-[22px] leading-[2.2] text-paper-ink">
              {renderText()}
            </div>
          )}
        </div>
      </div>

      <div className="paper-card rounded-2xl p-5 h-fit sticky top-6">
        <div className="flex items-center gap-2 mb-4">
          <Languages size={18} className="text-crimson" />
          <h3 className="font-jp text-indigo-dark font-semibold">読み方ガイド</h3>
        </div>
        {pinned ? (
          <div>
            <div className="text-2xl font-jp text-indigo-dark">
              {pinned.token.surface_form}
            </div>
            <div className="mt-1 text-paper-ink/70 text-sm">
              {pinned.token.reading ?? ""}
              {pinned.token.reading && " · "}
              {pinned.token.pos}
            </div>

            {pinned.match ? (
              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-xs text-paper-ink/50 mb-1">Furigana / Kana</div>
                  <div className="text-jp text-lg">
                    {pinned.match.kana}{" "}
                    <span className="text-sm text-paper-ink/60">
                      {pinned.match.romaji}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-paper-ink/50 mb-1">Burmese meaning</div>
                  <div className="text-mm text-2xl text-indigo-dark leading-snug">
                    {pinned.match.burmeseMeaning}
                  </div>
                </div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    pinned.match.jlptLevel === "N5"
                      ? "bg-crimson/10 text-crimson"
                      : "bg-indigo-dark/10 text-indigo-dark"
                  }`}
                >
                  JLPT {pinned.match.jlptLevel}
                </span>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-crimson font-medium">
                    <BookmarkCheck size={14} /> Already in deck
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-paper-ink/60 mb-3">
                  Not in the vocabulary database yet. Add it to start learning this word.
                </p>
                <button
                  disabled={adding !== null}
                  onClick={() => addToDeck(pinned.token)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-crimson text-paper font-semibold hover:bg-crimson-soft disabled:opacity-50 transition-colors"
                >
                  {adding === pinned.token.surface_form ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Add to Flashcard Deck
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-paper-ink/50 leading-relaxed">
            Hover or tap any highlighted Japanese word to see its furigana, romaji and
            Burmese translation. Words already in your deck show a JLPT level badge.
          </p>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-dark text-paper px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
