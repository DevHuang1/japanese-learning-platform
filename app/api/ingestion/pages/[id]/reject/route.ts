import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const page = await db.ingestionPage.findUnique({ where: { id } });
    if (!page) return NextResponse.json({ error: "Ingestion page not found" }, { status: 404 });
    await db.$transaction([
      db.ingestionCandidate.updateMany({ where: { pageId: id, status: "pending" }, data: { status: "rejected" } }),
      db.ingestionPage.update({ where: { id }, data: { status: "rejected", errorCategory: "operator_rejected", errorMessage: typeof body.reason === "string" ? body.reason.slice(0, 500) : null } }),
    ]);
    return NextResponse.json({ pageId: id, status: "rejected" });
  } catch (error) {
    console.error("[ingestion/pages/:id/reject]", error);
    return NextResponse.json({ error: "Failed to reject ingestion page" }, { status: 500 });
  }
}
