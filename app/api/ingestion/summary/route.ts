import { NextResponse } from "next/server";
import { dashboardSummary, dateRange } from "@/lib/ingestion-dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(await dashboardSummary(dateRange(url.searchParams)));
  } catch (error) {
    console.error("[ingestion/summary]", error);
    return NextResponse.json({ error: "Failed to load ingestion summary" }, { status: 500 });
  }
}
