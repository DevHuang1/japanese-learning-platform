import { Prisma } from "@prisma/client";
import { normalizeKanaForStorage, vocabularyIdentity } from "@/lib/ingestion-utils";

export const collisionSelect = {
  id: true,
  canonicalKey: true,
  kanji: true,
  kana: true,
  romaji: true,
  burmeseMeaning: true,
  jlptLevel: true,
  partOfSpeech: true,
  exampleSentenceJp: true,
  exampleSentenceMm: true,
  lesson: true,
  pdfSource: true,
  createdAt: true,
  progress: { select: { id: true, status: true, repetitions: true } },
} as const;

export type CollisionRow = Prisma.VocabularyGetPayload<{ select: typeof collisionSelect }>;

export function groupCollisionRows(rows: CollisionRow[]) {
  const groups = new Map<string, CollisionRow[]>();
  for (const row of rows) {
    const key = vocabularyIdentity(row).canonicalKey;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([canonicalKey, group]) => ({
      canonicalKey,
      rows: group.sort((left, right) => {
        const leftScore = Number(Boolean(left.kanji)) + Number(Boolean(left.exampleSentenceJp)) + Number(Boolean(left.progress));
        const rightScore = Number(Boolean(right.kanji)) + Number(Boolean(right.exampleSentenceJp)) + Number(Boolean(right.progress));
        return rightScore - leftScore || left.createdAt.getTime() - right.createdAt.getTime();
      }),
    }));
}

export async function mergeCollision(
  tx: Prisma.TransactionClient,
  sourceId: string,
  targetId: string,
) {
  if (!sourceId || !targetId || sourceId === targetId) {
    throw new Error("COLLISION_INVALID_ROWS");
  }

  const source = await tx.vocabulary.findUnique({
    where: { id: sourceId },
    select: collisionSelect,
  });
  const target = await tx.vocabulary.findUnique({
    where: { id: targetId },
    select: collisionSelect,
  });
  if (!source || !target) throw new Error("COLLISION_ROW_NOT_FOUND");

  const sourceIdentity = vocabularyIdentity(source);
  const targetIdentity = vocabularyIdentity(target);
  if (sourceIdentity.canonicalKey !== targetIdentity.canonicalKey) {
    throw new Error("COLLISION_KEYS_DIFFER");
  }

  const occupied = await tx.vocabulary.findFirst({
    where: { canonicalKey: targetIdentity.canonicalKey, NOT: { id: target.id } },
    select: { id: true },
  });
  if (occupied) throw new Error("COLLISION_KEY_ALREADY_OCCUPIED");

  await tx.vocabularyMatchReview.updateMany({
    where: { candidateId: source.id },
    data: { candidateId: target.id },
  });

  if (source.progress && !target.progress) {
    await tx.userWordProgress.update({
      where: { vocabId: source.id },
      data: { vocabId: target.id },
    });
  } else if (source.progress && target.progress) {
    await tx.userWordProgress.delete({ where: { vocabId: source.id } });
  }

  const mergedTarget = await tx.vocabulary.update({
    where: { id: target.id },
    data: {
      canonicalKey: targetIdentity.canonicalKey,
      kanji: target.kanji ?? source.kanji,
      kana: normalizeKanaForStorage(target.kana),
      romaji: target.romaji ?? source.romaji,
      burmeseMeaning: target.burmeseMeaning || source.burmeseMeaning,
      jlptLevel: target.jlptLevel || source.jlptLevel,
      partOfSpeech: target.partOfSpeech ?? source.partOfSpeech,
      exampleSentenceJp: target.exampleSentenceJp ?? source.exampleSentenceJp,
      exampleSentenceMm: target.exampleSentenceMm ?? source.exampleSentenceMm,
      lesson: target.lesson ?? source.lesson,
    },
    select: collisionSelect,
  });
  await tx.vocabulary.delete({ where: { id: source.id } });
  return { mergedTarget, removedId: source.id };
}

export function collisionErrorResponseMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "COLLISION_INVALID_ROWS") return "sourceId and a different targetId are required";
  if (message === "COLLISION_ROW_NOT_FOUND") return "Collision row not found";
  if (message === "COLLISION_KEYS_DIFFER") return "These rows do not share the same normalized identity";
  if (message === "COLLISION_KEY_ALREADY_OCCUPIED") return "The canonical identity is already occupied by another row";
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "The canonical identity is already occupied by another row";
  }
  return null;
}
