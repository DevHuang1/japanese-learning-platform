import { NextResponse } from "next/server";
import { dashboardTrends, dateRange } from "@/lib/ingestion-dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json({ trends: await dashboardTrends(dateRange(url.searchParams)) });
  } catch (error) {
    console.error("[ingestion/trends]", error);
    return NextResponse.json({ error: "Failed to load ingestion trends" }, { status: 500 });
  }
}
