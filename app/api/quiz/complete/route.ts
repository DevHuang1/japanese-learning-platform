import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const score = Number(body.score) || 0;
    const total = Number(body.total) || 0;
    const accuracy = total > 0 ? score / total : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const log = await db.studyLog.findFirst({ where: { studyDate: today } });
    if (log) {
      const prevAccuracy = log.accuracyScore * log.quizzesCompleted;
      await db.studyLog.update({
        where: { id: log.id },
        data: {
          quizzesCompleted: log.quizzesCompleted + 1,
          accuracyScore:
            (prevAccuracy + accuracy) / (log.quizzesCompleted + 1),
        },
      });
    } else {
      await db.studyLog.create({
        data: {
          studyDate: today,
          quizzesCompleted: 1,
          accuracyScore: accuracy,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[quiz/complete]", e);
    return NextResponse.json({ error: "Failed to log quiz" }, { status: 500 });
  }
}
