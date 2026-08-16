import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalVocabularyKey, normalizeExtractedWord } from "@/lib/ingestion-utils";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const page = await db.ingestionPage.findUnique({ where: { id }, include: { candidates: true } });
    if (!page) return NextResponse.json({ error: "Ingestion page not found" }, { status: 404 });

    const result = await db.$transaction(async (tx) => {
      let imported = 0;
      let reviews = 0;
      for (const candidate of page.candidates.filter((item) => item.status === "pending")) {
        const word = normalizeExtractedWord(JSON.parse(candidate.incomingJson));
        if (!word) {
          await tx.ingestionCandidate.update({ where: { id: candidate.id }, data: { status: "rejected", decisionKind: "invalid" } });
          continue;
        }
        const canonicalKey = canonicalVocabularyKey(word);
        const existing = await tx.vocabulary.findUnique({ where: { canonicalKey } });
        if (candidate.decisionKind === "review") {
          const reviewKey = `ingestion:${candidate.id}`;
          const review = await tx.vocabularyMatchReview.upsert({
            where: { reviewKey },
            update: { status: "pending", incomingJson: JSON.stringify(word), candidateId: existing?.id ?? null },
            create: {
              reviewKey,
              incomingJson: JSON.stringify(word),
              candidateId: existing?.id ?? null,
              score: candidate.score ?? 0,
              reasonsJson: candidate.reasonsJson ?? JSON.stringify(["manual OCR review required"]),
              source: `ingestion-page:${id}`,
            },
          });
          await tx.ingestionCandidate.update({ where: { id: candidate.id }, data: { status: "review", reviewId: review.id, vocabularyId: existing?.id ?? null } });
          reviews += 1;
          continue;
        }
        if (existing) {
          await tx.ingestionCandidate.update({ where: { id: candidate.id }, data: { status: "approved", vocabularyId: existing.id, canonicalKey } });
          continue;
        }
        const created = await tx.vocabulary.create({
          data: {
            canonicalKey,
            kanji: word.kanji ?? null,
            kana: word.kana,
            romaji: word.romaji ?? null,
            burmeseMeaning: word.burmese_meaning,
            jlptLevel: word.jlpt_level,
            partOfSpeech: word.part_of_speech ?? null,
            exampleSentenceJp: word.example_sentence_jp ?? null,
            exampleSentenceMm: word.example_sentence_mm ?? null,
            lesson: word.lesson ?? null,
            pdfSource: `ingestion-page:${id}`,
          },
        });
        await tx.ingestionCandidate.update({ where: { id: candidate.id }, data: { status: "approved", vocabularyId: created.id, canonicalKey } });
        imported += 1;
      }
      await tx.ingestionPage.update({ where: { id }, data: { status: reviews ? "needs_review" : "approved" } });
      return { imported, reviews };
    });
    return NextResponse.json({ pageId: id, status: result.reviews ? "needs_review" : "approved", ...result });
  } catch (error) {
    console.error("[ingestion/pages/:id/approve]", error);
    return NextResponse.json({ error: "Failed to approve ingestion page" }, { status: 500 });
  }
}
