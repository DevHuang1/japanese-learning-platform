import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  normalizeKanaForStorage,
  normalizeSurface,
  vocabularyIdentity,
} from "@/lib/ingestion-utils";

export const dynamic = "force-dynamic";

const vocabularySelect = {
  id: true,
  canonicalKey: true,
  kanji: true,
  kana: true,
  romaji: true,
  burmeseMeaning: true,
  jlptLevel: true,
  partOfSpeech: true,
  pdfSource: true,
  createdAt: true,
} as const;

export async function GET() {
  const vocab = await db.vocabulary.findMany({
    select: vocabularySelect,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ vocab });
}

export async function POST(req: Request) {
  let submittedIdentity: ReturnType<typeof vocabularyIdentity> | null = null;
  try {
    const body = await req.json();
    const kana = normalizeKanaForStorage(String(body.kana ?? ""));
    const kanji = normalizeSurface(body.kanji ? String(body.kanji) : undefined);
    if (!kana) return NextResponse.json({ error: "kana is required" }, { status: 400 });

    const identity = vocabularyIdentity({ kanji, kana });
    submittedIdentity = identity;
    const candidates = await db.vocabulary.findMany({
      where: {
        OR: [
          { canonicalKey: identity.canonicalKey },
          { kana },
        ],
      },
      select: {
        ...vocabularySelect,
        lesson: true,
        exampleSentenceJp: true,
        exampleSentenceMm: true,
      },
    });
    const exact = candidates.find(
      (candidate) =>
        candidate.canonicalKey === identity.canonicalKey ||
        vocabularyIdentity(candidate).canonicalKey === identity.canonicalKey,
    );
    if (exact) return NextResponse.json({ existing: exact }, { status: 200 });

    const incompleteMatches = candidates.filter(
      (candidate) =>
        !candidate.kanji &&
        vocabularyIdentity(candidate).readingKey === identity.readingKey,
    );
    if (incompleteMatches.length === 1) {
      const existing = incompleteMatches[0];
      const updated = await db.vocabulary.update({
        where: { id: existing.id },
        data: {
          canonicalKey: identity.canonicalKey,
          kanji: kanji || existing.kanji,
        },
        select: vocabularySelect,
      });
      return NextResponse.json({ existing: updated }, { status: 200 });
    }

    const level = body.jlptLevel === "N4" ? "N4" : "N5";
    const vocab = await db.vocabulary.create({
      data: {
        canonicalKey: identity.canonicalKey,
        kanji: kanji || null,
        kana,
        romaji: body.romaji || null,
        burmeseMeaning: String(body.burmeseMeaning ?? "").trim() || kana,
        jlptLevel: level,
        partOfSpeech: body.partOfSpeech || null,
        pdfSource: "reader",
      },
      select: vocabularySelect,
    });
    await db.userWordProgress.create({ data: { vocabId: vocab.id } });
    return NextResponse.json({ vocab }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      if (!submittedIdentity) {
        return NextResponse.json({ error: "Duplicate identity could not be reconstructed" }, { status: 409 });
      }
      const existing = await db.vocabulary.findUnique({
        where: { canonicalKey: submittedIdentity.canonicalKey },
        select: vocabularySelect,
      });
      if (existing) return NextResponse.json({ existing }, { status: 200 });
    }
    console.error("[vocabulary]", error);
    return NextResponse.json({ error: "Failed to save word" }, { status: 500 });
  }
}
