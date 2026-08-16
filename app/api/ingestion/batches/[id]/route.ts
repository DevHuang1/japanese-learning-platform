import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeJson, serializeBatch } from "@/lib/ingestion-dashboard";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const batch = await db.ingestionBatch.findUnique({
      where: { id },
      include: {
        _count: { select: { pages: true, candidates: true } },
        metrics: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!batch) return NextResponse.json({ error: "Ingestion batch not found" }, { status: 404 });
    return NextResponse.json({
      batch: serializeBatch(batch),
      counts: batch._count,
      metrics: batch.metrics.map((metric) => ({ ...metric, dimensions: safeJson(metric.dimensionsJson, {}) })),
    });
  } catch (error) {
    console.error("[ingestion/batches/:id]", error);
    return NextResponse.json({ error: "Failed to load ingestion batch" }, { status: 500 });
  }
}
