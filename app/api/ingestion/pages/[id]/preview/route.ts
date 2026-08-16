import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalVocabularyKey, normalizeExtractedWord } from "@/lib/ingestion-utils";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const page = await db.ingestionPage.findUnique({ where: { id }, include: { candidates: true } });
    if (!page) return NextResponse.json({ error: "Ingestion page not found" }, { status: 404 });
    const preview = [];
    for (const candidate of page.candidates.filter((item) => item.status === "pending")) {
      const word = normalizeExtractedWord(JSON.parse(candidate.incomingJson));
      if (!word) continue;
      const canonicalKey = canonicalVocabularyKey(word);
      const existing = await db.vocabulary.findUnique({ where: { canonicalKey } });
      preview.push({
        candidateId: candidate.id,
        word,
        canonicalKey,
        decision: existing ? "exact" : "new",
        existingVocabularyId: existing?.id ?? null,
        reasons: existing ? ["canonical key already exists"] : ["no exact canonical match"],
        collisionRisk: existing ? "low" : "unknown",
      });
    }
    return NextResponse.json({ pageId: id, revision: page.revision, preview });
  } catch (error) {
    console.error("[ingestion/pages/:id/preview]", error);
    return NextResponse.json({ error: "Failed to build ingestion preview" }, { status: 500 });
  }
}
