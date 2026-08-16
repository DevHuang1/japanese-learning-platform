import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  canonicalVocabularyKey,
  normalizeExtractedWord,
  normalizeKanaForStorage,
  normalizeSurface,
} from "@/lib/ingestion-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const reviews = await db.vocabularyMatchReview.findMany({
    where: { status: "pending" },
    include: { candidate: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ reviews });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const reviewId = typeof body.id === "string" ? body.id : "";
    const action = body.action === "accept" || body.action === "reject" ? body.action : "";
    if (!reviewId || !action) {
      return NextResponse.json(
        { error: "id and action (accept or reject) are required" },
        { status: 400 },
      );
    }

    const review = await db.vocabularyMatchReview.findUnique({
      where: { id: reviewId },
      include: { candidate: true },
    });
    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    if (review.status !== "pending") {
      return NextResponse.json({ error: "Review has already been decided" }, { status: 409 });
    }

    if (action === "reject") {
      const updated = await db.vocabularyMatchReview.update({
        where: { id: review.id },
        data: { status: "rejected" },
      });
      return NextResponse.json({ review: updated });
    }

    if (!review.candidate) {
      return NextResponse.json(
        { error: "The candidate vocabulary row no longer exists" },
        { status: 409 },
      );
    }

    const incoming = normalizeExtractedWord(JSON.parse(review.incomingJson));
    if (!incoming) {
      return NextResponse.json({ error: "Stored review payload is invalid" }, { status: 422 });
    }

    const updated = await db.$transaction(async (tx) => {
      const vocab = await tx.vocabulary.update({
        where: { id: review.candidate!.id },
        data: {
          canonicalKey: canonicalVocabularyKey(incoming),
          kanji: normalizeSurface(incoming.kanji) || review.candidate!.kanji,
          kana: normalizeKanaForStorage(incoming.kana),
          romaji: review.candidate!.romaji ?? incoming.romaji ?? null,
          partOfSpeech: review.candidate!.partOfSpeech ?? incoming.part_of_speech ?? null,
          exampleSentenceJp:
            review.candidate!.exampleSentenceJp ?? incoming.example_sentence_jp ?? null,
          exampleSentenceMm:
            review.candidate!.exampleSentenceMm ?? incoming.example_sentence_mm ?? null,
          lesson: review.candidate!.lesson ?? incoming.lesson ?? null,
        },
      });
      const decidedReview = await tx.vocabularyMatchReview.update({
        where: { id: review.id },
        data: { status: "accepted" },
      });
      return { vocab, review: decidedReview };
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Accepting this review would create a duplicate vocabulary identity" },
        { status: 409 },
      );
    }
    console.error("[vocabulary/reviews]", error);
    return NextResponse.json({ error: "Failed to update vocabulary review" }, { status: 500 });
  }
}
