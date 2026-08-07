import type { Metadata } from "next";
import { db } from "@/lib/db";
import { FlashcardDeck, type FlashcardData } from "@/components/FlashcardDeck";
import { Layers } from "lucide-react";

export const metadata: Metadata = { title: "Flashcards" };
export const dynamic = "force-dynamic";

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const params = await searchParams;
  const lessonFilter = params.lesson
    ? Number(params.lesson)
    : undefined;

  const now = new Date();
  const progressRows = await db.userWordProgress.findMany({
    where: {
      OR: [{ nextReviewDate: { lte: now } }, { repetitions: 0 }],
      ...(lessonFilter
        ? { vocab: { lesson: lessonFilter } }
        : {}),
    },
    include: { vocab: true },
    orderBy: [{ repetitions: "asc" }, { nextReviewDate: "asc" }],
    take: 24,
  });

  const cards: FlashcardData[] = progressRows.map((p) => ({
    vocabId: p.vocab.id,
    kanji: p.vocab.kanji,
    kana: p.vocab.kana,
    romaji: p.vocab.romaji,
    burmeseMeaning: p.vocab.burmeseMeaning,
    exampleSentenceJp: p.vocab.exampleSentenceJp,
    exampleSentenceMm: p.vocab.exampleSentenceMm,
    jlptLevel: p.vocab.jlptLevel,
  }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
           <span className="w-10 h-10 rounded-xl bg-crimson/10 text-crimson flex items-center justify-center">
            <Layers size={20} />
           </span>
           <div>
             <h1 className="font-jp text-2xl text-indigo-dark">単語カード</h1>
             <p className="text-sm text-paper-ink/60">Spaced-repetition flashcards · SM-2</p>
           </div>
        </div>
      </header>

      {lessonFilter && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-crimson/10 border border-crimson/20">
          <div className="text-sm text-crimson font-medium">
            第{lessonFilter}課 · Lesson {lessonFilter} — {cards.length} cards due
          </div>
          <a
            href="/flashcards"
            className="text-xs text-paper-ink/60 hover:text-crimson underline underline-offset-2"
          >
            Clear chapter filter
          </a>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="paper-card rounded-2xl p-12 text-center">
          <h2 className="font-jp text-xl text-indigo-dark mb-2">学習が完了しました</h2>
          <p className="text-paper-ink/70">
            No cards due right now. Seed the database or ingest more PDFs, then come back later.
          </p>
        </div>
      ) : (
        <FlashcardDeck initialCards={cards} />
      )}
    </div>
  );
}
