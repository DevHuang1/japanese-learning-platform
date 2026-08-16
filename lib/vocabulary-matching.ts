import {
  normalizeVocabularySurface,
  vocabularyIdentity,
  type IngestionWord,
} from "./ingestion-utils";

export interface StoredVocabularyForMatch {
  id: string;
  canonicalKey: string | null;
  kanji: string | null;
  kana: string;
  burmeseMeaning: string;
  partOfSpeech: string | null;
  romaji?: string | null;
  exampleSentenceJp?: string | null;
  exampleSentenceMm?: string | null;
  lesson?: number | null;
}

export type VocabularyMatchDecision =
  | { kind: "exact"; existingId: string }
  | { kind: "enrich"; existingId: string; reason: string }
  | { kind: "review"; existingId: string; score: number; reasons: string[] }
  | { kind: "new" };

function normalizeMeaning(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[၊။၊!?！？。、,.]/g, "");
}

function characterBigrams(value: string): Set<string> {
  const chars = Array.from(normalizeMeaning(value));
  const result = new Set<string>();
  for (let index = 0; index < chars.length - 1; index++) {
    result.add(`${chars[index]}${chars[index + 1]}`);
  }
  return result;
}

export function meaningSimilarity(left: string, right: string): number {
  const leftKey = normalizeMeaning(left);
  const rightKey = normalizeMeaning(right);
  if (!leftKey || !rightKey) return 0;
  if (leftKey === rightKey) return 1;

  const leftBigrams = characterBigrams(leftKey);
  const rightBigrams = characterBigrams(rightKey);
  if (leftBigrams.size === 0 || rightBigrams.size === 0) return 0;
  const intersection = [...leftBigrams].filter((gram) => rightBigrams.has(gram)).length;
  return intersection / new Set([...leftBigrams, ...rightBigrams]).size;
}

export function meaningsCompatible(left: string, right: string): boolean {
  return meaningSimilarity(left, right) >= 0.45;
}

export function levenshteinDistance(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row++) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column++) {
      const above = previous[column];
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + cost,
      );
      diagonal = above;
    }
  }

  return previous[b.length];
}

export function decideVocabularyMatch(
  incoming: IngestionWord,
  existingRows: StoredVocabularyForMatch[],
): VocabularyMatchDecision {
  const incomingIdentity = vocabularyIdentity(incoming);

  for (const existing of existingRows) {
    const existingIdentity = existing.canonicalKey
      ? {
          canonicalKey: existing.canonicalKey,
          surfaceKey: normalizeVocabularySurface(existing.kanji),
          readingKey: vocabularyIdentity(existing).readingKey,
        }
      : vocabularyIdentity(existing);

    if (existingIdentity.canonicalKey === incomingIdentity.canonicalKey) {
      return { kind: "exact", existingId: existing.id };
    }
  }

  const sameReadingCandidates = existingRows.filter(
    (existing) => vocabularyIdentity(existing).readingKey === incomingIdentity.readingKey,
  );
  if (sameReadingCandidates.length === 1) {
    const existing = sameReadingCandidates[0];
    const existingIdentity = vocabularyIdentity(existing);
    const oneSideMissingSurface = !existingIdentity.surfaceKey || !incomingIdentity.surfaceKey;

    if (
      oneSideMissingSurface &&
      meaningsCompatible(incoming.burmese_meaning, existing.burmeseMeaning)
    ) {
      return {
        kind: "enrich",
        existingId: existing.id,
        reason: "same normalized reading and one record lacks a kanji surface",
      };
    }
  }

  const fuzzyCandidates = existingRows
    .map((existing) => {
      const existingIdentity = vocabularyIdentity(existing);
      const sameSurface =
        incomingIdentity.surfaceKey.length > 0 &&
        incomingIdentity.surfaceKey === existingIdentity.surfaceKey;
      const readingDistance = levenshteinDistance(
        incomingIdentity.readingKey,
        existingIdentity.readingKey,
      );
      const sameMeaning = meaningsCompatible(
        incoming.burmese_meaning,
        existing.burmeseMeaning,
      );

      if (!sameSurface || readingDistance > 1 || !sameMeaning) return null;
      const score = Number(
        (0.88 + (sameMeaning ? 0.08 : 0) - readingDistance * 0.05).toFixed(3),
      );
      return {
        id: existing.id,
        score,
        reasons: [
          "same normalized kanji surface",
          `kana edit distance ${readingDistance}`,
          "compatible Burmese meaning",
        ],
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((left, right) => right.score - left.score);

  const best = fuzzyCandidates[0];
  if (best) {
    return {
      kind: "review",
      existingId: best.id,
      score: best.score,
      reasons: best.reasons,
    };
  }

  return { kind: "new" };
}
