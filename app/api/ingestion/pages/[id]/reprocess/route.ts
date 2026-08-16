import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalVocabularyKey, normalizePdfText, normalizeExtractedWord } from "@/lib/ingestion-utils";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const page = await db.ingestionPage.findUnique({
      where: { id },
      include: { batch: true, candidates: true },
    });
    if (!page) return NextResponse.json({ error: "Ingestion page not found" }, { status: 404 });
    const normalizedText = normalizePdfText(page.rawText ?? "");
    const parsed = normalizedText
      .split(/\n|;/u)
      .map((line) => {
        const [kanji, kana, meaning] = line.split(/\s+/u);
        return normalizeExtractedWord({ kanji, kana, burmese_meaning: meaning, jlpt_level: "N5" });
      })
      .filter((word): word is NonNullable<typeof word> => Boolean(word));

    await db.$transaction(async (tx) => {
      await tx.ingestionCandidate.deleteMany({ where: { pageId: id, status: "pending" } });
      for (const word of parsed) {
        const canonicalKey = canonicalVocabularyKey(word);
        const existing = await tx.vocabulary.findUnique({ where: { canonicalKey } });
        await tx.ingestionCandidate.create({
          data: {
            batchId: page.batchId,
            pageId: id,
            incomingJson: JSON.stringify(word),
            canonicalKey,
            decisionKind: existing ? "exact" : "new",
            status: "pending",
            vocabularyId: existing?.id,
            reasonsJson: JSON.stringify(existing ? ["canonical key already exists"] : ["no exact canonical match"]),
          },
        });
      }
      await tx.ingestionPage.update({
        where: { id },
        data: { normalizedText, status: parsed.length ? "needs_review" : "failed", errorCategory: parsed.length ? null : "no_valid_candidates" },
      });
    });

    return NextResponse.json({ pageId: id, status: parsed.length ? "needs_review" : "failed", candidates: parsed.length });
  } catch (error) {
    console.error("[ingestion/pages/:id/reprocess]", error);
    return NextResponse.json({ error: "Failed to reprocess OCR page" }, { status: 500 });
  }
}
