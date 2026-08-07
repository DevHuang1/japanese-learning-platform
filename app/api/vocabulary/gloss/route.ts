import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const vocab = await db.vocabulary.findMany({
    select: {
      kanji: true,
      kana: true,
      romaji: true,
      burmeseMeaning: true,
      jlptLevel: true,
    },
  });
  return NextResponse.json({ vocab });
}
