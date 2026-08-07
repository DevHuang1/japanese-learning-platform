import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sm2, nextReviewDateFromInterval, type Rating } from "@/lib/sm2";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const vocabId: string = body.vocabId;
    const grade = Number(body.rating) as Rating;

    if (!vocabId || ![0, 3, 4, 5].includes(grade)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const progress = await db.userWordProgress.findUnique({
      where: { vocabId },
    });
    if (!progress) {
      return NextResponse.json({ error: "Progress not found" }, { status: 404 });
    }

    const next = sm2(grade, {
      easeFactor: progress.easeFactor,
      interval: progress.interval,
      repetitions: progress.repetitions,
      status: progress.status as "learning" | "reviewing" | "mastered",
    });

    await db.userWordProgress.update({
      where: { id: progress.id },
      data: {
        easeFactor: next.easeFactor,
        interval: next.interval,
        repetitions: next.repetitions,
        status: next.status,
        nextReviewDate: nextReviewDateFromInterval(next.interval),
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const log = await db.studyLog.findFirst({
      where: { studyDate: today },
    });
    if (log) {
      await db.studyLog.update({
        where: { id: log.id },
        data: { wordsReviewed: log.wordsReviewed + 1 },
      });
    } else {
      await db.studyLog.create({
        data: {
          studyDate: today,
          wordsReviewed: 1,
        },
      });
    }

    return NextResponse.json({ ok: true, next });
  } catch (e) {
    console.error("[flashcards/rate]", e);
    return NextResponse.json({ error: "Failed to rate card" }, { status: 500 });
  }
}
