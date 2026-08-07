import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nextReviewDateFromInterval } from "@/lib/sm2";

export const dynamic = "force-dynamic";

const VALID = ["learning", "reviewing", "mastered"] as const;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const vocabId = String(body.vocabId ?? "");
    const status = String(body.status ?? "");

    if (!vocabId || !VALID.includes(status as (typeof VALID)[number])) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const progress = await db.userWordProgress.findUnique({
      where: { vocabId },
    });
    if (!progress) {
      return NextResponse.json({ error: "Progress not found" }, { status: 404 });
    }

    if (status === "mastered") {
      await db.userWordProgress.update({
        where: { id: progress.id },
        data: {
          status,
          interval: 21,
          repetitions: 3,
          nextReviewDate: nextReviewDateFromInterval(21),
        },
      });
    } else {
      await db.userWordProgress.update({
        where: { id: progress.id },
        data: {
          status,
          interval: 0,
          repetitions: 0,
          nextReviewDate: new Date(),
        },
      });
    }

    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error("[vocabulary/status]", e);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
