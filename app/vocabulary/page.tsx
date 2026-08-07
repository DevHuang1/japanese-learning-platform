import type { Metadata } from "next";
import { db } from "@/lib/db";
import { VocabularyList, type VocabRow } from "@/components/VocabularyList";
import { Languages } from "lucide-react";

export const metadata: Metadata = { title: "Vocabulary" };
export const dynamic = "force-dynamic";

export default async function VocabularyPage() {
  const rows = await db.vocabulary.findMany({
    include: { progress: true },
    orderBy: [{ jlptLevel: "asc" }, { kana: "asc" }],
    take: 1000,
  });

  const data: VocabRow[] = rows.map((r) => ({
    id: r.id,
    kanji: r.kanji,
    kana: r.kana,
    romaji: r.romaji,
    burmeseMeaning: r.burmeseMeaning,
    jlptLevel: r.jlptLevel,
    partOfSpeech: r.partOfSpeech,
    exampleSentenceJp: r.exampleSentenceJp,
    exampleSentenceMm: r.exampleSentenceMm,
    pdfSource: r.pdfSource,
    lesson: r.lesson,
    status: r.progress?.status ?? "learning",
    nextReviewDate: r.progress?.nextReviewDate?.toISOString() ?? null,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
           <span className="w-10 h-10 rounded-xl bg-crimson/10 text-crimson flex items-center justify-center">
             <Languages size={20} />
           </span>
           <div>
             <h1 className="font-jp text-2xl text-indigo-dark">語彙</h1>
             <p className="text-sm text-paper-ink/60">Vocabulary library · {rows.length} words</p>
           </div>
        </div>
      </header>
      <VocabularyList rows={data} />
    </div>
  );
}
