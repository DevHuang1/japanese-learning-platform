import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dateRange, serializeBatch } from "@/lib/ingestion-dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);
    const status = url.searchParams.get("status");
    const source = url.searchParams.get("source");
    const rows = await db.ingestionBatch.findMany({
      where: {
        createdAt: dateRange(url.searchParams),
        ...(status ? { status } : {}),
        ...(source ? { sourceName: { contains: source } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Number.isFinite(limit) && limit > 0 ? limit : 25,
    });
    return NextResponse.json({ batches: rows.map(serializeBatch) });
  } catch (error) {
    console.error("[ingestion/batches]", error);
    return NextResponse.json({ error: "Failed to load ingestion batches" }, { status: 500 });
  }
}
