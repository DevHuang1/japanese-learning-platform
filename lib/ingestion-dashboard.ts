import { db } from "@/lib/db";

export const ingestionStatuses = [
  "queued",
  "processing",
  "needs_review",
  "approved",
  "completed",
  "failed",
  "cancelled",
] as const;

export function dateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  return {
    gte: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
    lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
  };
}

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function serializeBatch(batch: {
  id: string;
  sourceName: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  selectablePages: number;
  ocrPages: number;
  totalPages: number;
  extractedCandidates: number;
  importedCandidates: number;
  duplicateCount: number;
  reviewCount: number;
  failedPages: number;
  durationMs: number | null;
  createdAt: Date;
}) {
  return {
    ...batch,
    startedAt: batch.startedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
  };
}

export async function dashboardSummary(range: { gte?: Date; lte?: Date }) {
  const where = { createdAt: range };
  const [batches, pendingCandidates, attentionPages] = await Promise.all([
    db.ingestionBatch.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
    db.ingestionCandidate.count({ where: { status: "pending", batch: where } }),
    db.ingestionPage.count({
      where: {
        status: "needs_review",
        batch: where,
      },
    }),
  ]);

  const completed = batches.filter((batch) => batch.status === "completed");
  const totalCandidates = batches.reduce((sum, batch) => sum + batch.extractedCandidates, 0);
  const ocrPages = batches.reduce((sum, batch) => sum + batch.ocrPages, 0);
  const totalPages = batches.reduce((sum, batch) => sum + batch.totalPages, 0);
  const duplicateCount = batches.reduce((sum, batch) => sum + batch.duplicateCount, 0);
  const reviewCount = batches.reduce((sum, batch) => sum + batch.reviewCount, 0);
  const durations = completed
    .map((batch) => batch.durationMs)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0;
  const p95 = durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] : 0;

  return {
    range,
    batches: {
      total: batches.length,
      completed: completed.length,
      failed: batches.filter((batch) => batch.status === "failed").length,
      needsReview: batches.filter((batch) => batch.status === "needs_review").length,
    },
    quality: {
      selectableAccuracy: totalCandidates ? (totalCandidates - duplicateCount) / totalCandidates : 0,
      ocrAccuracy: ocrPages ? completed.reduce((sum, batch) => sum + batch.importedCandidates, 0) / Math.max(1, totalCandidates) : 0,
      ocrPageRate: totalPages ? ocrPages / totalPages : 0,
      duplicateRate: totalCandidates ? duplicateCount / totalCandidates : 0,
      fuzzyReviewRate: totalCandidates ? reviewCount / totalCandidates : 0,
    },
    performance: { medianDurationMs: median, p95DurationMs: p95 },
    attention: { pages: attentionPages, candidates: pendingCandidates },
  };
}

export async function dashboardTrends(range: { gte?: Date; lte?: Date }) {
  const batches = await db.ingestionBatch.findMany({
    where: { createdAt: range },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      totalPages: true,
      ocrPages: true,
      extractedCandidates: true,
      duplicateCount: true,
      reviewCount: true,
      durationMs: true,
    },
  });
  const buckets = new Map<string, { batches: number; pages: number; ocrPages: number; candidates: number; duplicates: number; reviews: number; duration: number[] }>();
  for (const batch of batches) {
    const key = batch.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key) ?? { batches: 0, pages: 0, ocrPages: 0, candidates: 0, duplicates: 0, reviews: 0, duration: [] };
    bucket.batches += 1;
    bucket.pages += batch.totalPages;
    bucket.ocrPages += batch.ocrPages;
    bucket.candidates += batch.extractedCandidates;
    bucket.duplicates += batch.duplicateCount;
    bucket.reviews += batch.reviewCount;
    if (batch.durationMs !== null) bucket.duration.push(batch.durationMs);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()].map(([date, bucket]) => ({
    date,
    batches: bucket.batches,
    ocrPageRate: bucket.pages ? bucket.ocrPages / bucket.pages : 0,
    duplicateRate: bucket.candidates ? bucket.duplicates / bucket.candidates : 0,
    fuzzyReviewRate: bucket.candidates ? bucket.reviews / bucket.candidates : 0,
    averageDurationMs: bucket.duration.length ? Math.round(bucket.duration.reduce((a, b) => a + b, 0) / bucket.duration.length) : 0,
  }));
}
