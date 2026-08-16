import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeJson } from "@/lib/ingestion-dashboard";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const page = await db.ingestionPage.findUnique({
      where: { id },
      include: {
        batch: { select: { id: true, sourceName: true, status: true } },
        corrections: { orderBy: { revision: "desc" } },
        candidates: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!page) return NextResponse.json({ error: "Ingestion page not found" }, { status: 404 });
    return NextResponse.json({
      page: {
        ...page,
        candidates: page.candidates.map((candidate) => ({
          ...candidate,
          incoming: safeJson(candidate.incomingJson, {}),
          reasons: safeJson(candidate.reasonsJson, []),
        })),
        corrections: page.corrections.map((correction) => ({
          ...correction,
          fieldEdits: safeJson(correction.fieldEditsJson, {}),
        })),
      },
    });
  } catch (error) {
    console.error("[ingestion/pages/:id]", error);
    return NextResponse.json({ error: "Failed to load ingestion page" }, { status: 500 });
  }
}
