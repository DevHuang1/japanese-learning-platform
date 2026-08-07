import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiGenerateQuiz, fallbackGenerateQuiz } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const count = Math.min(Math.max(Number(body.count) || 5, 1), 10);
    const level: string | undefined = body.level;

    const where =
      level === "N5" || level === "N4" ? { jlptLevel: level } : {};

    const vocab = await db.vocabulary.findMany({
      where,
      select: {
        id: true,
        kanji: true,
        kana: true,
        romaji: true,
        burmeseMeaning: true,
        jlptLevel: true,
      },
      orderBy: { createdAt: "asc" },
      take: 40,
    });

    if (vocab.length === 0) {
      return NextResponse.json(
        { error: "No vocabulary found. Seed the database or ingest PDFs first." },
        { status: 404 }
      );
    }

    const shuffled = [...vocab].sort(() => Math.random() - 0.5).slice(0, Math.max(count * 4, 16));
    const material = shuffled.map((w) => ({
      kanji: w.kanji ?? undefined,
      kana: w.kana,
      burmese_meaning: w.burmeseMeaning,
    }));

    let questions;
    try {
      questions = await aiGenerateQuiz(material, count);
    } catch {
      questions = fallbackGenerateQuiz(material, count);
    }

    if (!questions || questions.length === 0) {
      questions = fallbackGenerateQuiz(material, count);
    }

    const withIds = questions.map((q, i) => ({
      ...q,
      id: q.id ?? `q${Date.now()}-${i}`,
      word: shuffled[i % shuffled.length],
    }));

    return NextResponse.json({ questions: withIds });
  } catch (e) {
    console.error("[quiz/generate]", e);
    return NextResponse.json(
      { error: "Failed to generate quiz." },
      { status: 500 }
    );
  }
}
