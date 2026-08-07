import type { Metadata } from "next";
import { db } from "@/lib/db";
import { DashboardClient, type DashboardStats } from "@/components/DashboardClient";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function computeStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const days = new Set(dates.map((d) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  }));
  const DAY = 86_400_000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = today;
  if (!days.has(cursor.getTime())) cursor = new Date(cursor.getTime() - DAY);
  let streak = 0;
  while (days.has(cursor.getTime())) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return streak;
}

export default async function DashboardPage() {
  const [vocabCounts, progressCounts, dueCount, logs, todayLog] = await Promise.all([
    db.vocabulary.groupBy({
      by: ["jlptLevel"],
      _count: { id: true },
    }),
    db.userWordProgress.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    db.userWordProgress.count({
      where: { nextReviewDate: { lte: new Date() } },
    }),
    db.studyLog.findMany({ select: { studyDate: true }, orderBy: { studyDate: "asc" } }),
    db.studyLog.findFirst({
      where: { studyDate: { gte: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })() } },
    }),
  ]);

  const n5 = vocabCounts.find((v) => v.jlptLevel === "N5")?._count.id ?? 0;
  const n4 = vocabCounts.find((v) => v.jlptLevel === "N4")?._count.id ?? 0;
  const totalVocab = n5 + n4;
  const mastered = progressCounts.find((p) => p.status === "mastered")?._count.id ?? 0;
  const learning = progressCounts.find((p) => p.status === "learning")?._count.id ?? 0;
  const reviewing = progressCounts.find((p) => p.status === "reviewing")?._count.id ?? 0;

  const stats: DashboardStats = {
    totalVocab,
    n5,
    n4,
    dueCards: dueCount,
    learning,
    reviewing,
    mastered,
    streak: computeStreak(logs.map((l) => l.studyDate)),
    todayWords: todayLog?.wordsReviewed ?? 0,
    todayQuizzes: todayLog?.quizzesCompleted ?? 0,
    todayAccuracy: todayLog?.accuracyScore ?? 0,
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <DashboardClient stats={stats} />
    </div>
  );
}
