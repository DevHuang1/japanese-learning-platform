import type { Metadata } from "next";
import { db } from "@/lib/db";
import { InteractiveReader, type ReaderVocab } from "@/components/InteractiveReader";
import { BookOpenText } from "lucide-react";

export const metadata: Metadata = { title: "Interactive Reader" };
export const dynamic = "force-dynamic";

export default async function ReaderPage() {
  const rows = await db.vocabulary.findMany({
    select: {
      id: true,
      kanji: true,
      kana: true,
      romaji: true,
      burmeseMeaning: true,
      jlptLevel: true,
    },
    take: 800,
  });

  const vocab: ReaderVocab[] = rows.map((r) => ({
    id: r.id,
    kanji: r.kanji,
    kana: r.kana,
    romaji: r.romaji,
    burmeseMeaning: r.burmeseMeaning,
    jlptLevel: r.jlptLevel,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
           <span className="w-10 h-10 rounded-xl bg-crimson/10 text-crimson flex items-center justify-center">
             <BookOpenText size={20} />
           </span>
           <div>
             <h1 className="font-jp text-2xl text-indigo-dark">リーダー</h1>
             <p className="text-sm text-paper-ink/60">
               Interactive reader · tokenized by kuromoji · {vocab.length} words loaded
             </p>
           </div>
        </div>
      </header>
      <InteractiveReader vocab={vocab} />
    </div>
  );
}
