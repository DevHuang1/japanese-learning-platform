import { NextResponse } from "next/server";
import { ingestFolder, ensureProgressForAll } from "@/lib/pdf-parser";
import { aiProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (aiProvider() === "none") {
    return NextResponse.json(
      {
        error:
          "No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env to extract vocabulary from PDFs.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await ingestFolder();
    const ensured = await ensureProgressForAll();
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      inserted: result.inserted,
      progressEnsured: ensured,
      failed: result.failed,
    });
  } catch (e) {
    console.error("[ingest]", e);
    return NextResponse.json(
      { error: "Ingestion failed. See server logs." },
      { status: 500 }
    );
  }
}
