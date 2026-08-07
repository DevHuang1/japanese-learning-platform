import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toHiragana } from "@/lib/japanese";

export const dynamic = "force-dynamic";

export async function GET() {
  const vocab = await db.vocabulary.findMany({
    select: {
      id: true,
      kanji: true,
      kana: true,
      romaji: true,
      burmeseMeaning: true,
      jlptLevel: true,
      partOfSpeech: true,
      pdfSource: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ vocab });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const kana = toHiragana(String(body.kana ?? "").trim());
    if (!kana) return NextResponse.json({ error: "kana is required" }, { status: 400 });

    const existing = await db.vocabulary.findFirst({ where: { kana } });
    if (existing) {
      return NextResponse.json({ existing }, { status: 200 });
    }

    const level = body.jlptLevel === "N4" ? "N4" : "N5";
    const vocab = await db.vocabulary.create({
      data: {
        kanji: body.kanji || null,
        kana,
        romaji: body.romaji || null,
        burmeseMeaning: String(body.burmeseMeaning ?? "").trim() || kana,
        jlptLevel: level,
        partOfSpeech: body.partOfSpeech || null,
        pdfSource: "reader",
      },
    });
    await db.userWordProgress.create({ data: { vocabId: vocab.id } });
    return NextResponse.json({ vocab }, { status: 201 });
  } catch (e) {
    console.error("[vocabulary]", e);
    return NextResponse.json({ error: "Failed to save word" }, { status: 500 });
  }
}
