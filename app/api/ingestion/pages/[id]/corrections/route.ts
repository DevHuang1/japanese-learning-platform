import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const correctedText = typeof body.correctedText === "string" ? body.correctedText.trim() : "";
    const baseRevision = Number(body.baseRevision);
    if (!correctedText || !Number.isInteger(baseRevision) || baseRevision < 0) {
      return NextResponse.json({ error: "correctedText and baseRevision are required" }, { status: 400 });
    }

    const page = await db.ingestionPage.findUnique({ where: { id } });
    if (!page) return NextResponse.json({ error: "Ingestion page not found" }, { status: 404 });
    if (page.revision !== baseRevision) {
      return NextResponse.json({ error: "Correction is stale", currentRevision: page.revision }, { status: 409 });
    }

    const correction = await db.$transaction(async (tx) => {
      const nextRevision = page.revision + 1;
      const saved = await tx.ocrCorrection.create({
        data: {
          pageId: id,
          candidateId: typeof body.candidateId === "string" ? body.candidateId : undefined,
          baseRevision,
          revision: nextRevision,
          originalText: page.rawText ?? "",
          correctedText,
          fieldEditsJson: JSON.stringify(body.fieldEdits ?? {}),
          reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined,
          actor: typeof body.actor === "string" ? body.actor.slice(0, 120) : "local-user",
        },
      });
      await tx.ingestionPage.update({
        where: { id },
        data: { revision: nextRevision, rawText: correctedText, status: "corrected" },
      });
      return saved;
    });

    return NextResponse.json({
      correctionId: correction.id,
      revision: correction.revision,
      status: "corrected",
      nextAction: "reprocess",
    }, { status: 201 });
  } catch (error) {
    console.error("[ingestion/pages/:id/corrections]", error);
    return NextResponse.json({ error: "Failed to save OCR correction" }, { status: 500 });
  }
}
