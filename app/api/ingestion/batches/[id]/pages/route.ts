import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeJson } from "@/lib/ingestion-dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const attentionOnly = url.searchParams.get("attention") === "true";
    const pages = await db.ingestionPage.findMany({
      where: { batchId: id, ...(attentionOnly ? { status: "needs_review" } : {}) },
      orderBy: { pageNumber: "asc" },
      include: {
        candidates: {
          orderBy: { createdAt: "asc" },
          take: 20,
          select: { id: true, decisionKind: true, status: true, score: true, incomingJson: true, reasonsJson: true },
        },
        _count: { select: { corrections: true } },
      },
    });
    return NextResponse.json({
      pages: pages.map((page) => ({
        ...page,
        candidates: page.candidates.map((candidate) => ({
          ...candidate,
          incoming: safeJson(candidate.incomingJson, {}),
          reasons: safeJson(candidate.reasonsJson, []),
        })),
      })),
    });
  } catch (error) {
    console.error("[ingestion/batches/:id/pages]", error);
    return NextResponse.json({ error: "Failed to load ingestion pages" }, { status: 500 });
  }
}
