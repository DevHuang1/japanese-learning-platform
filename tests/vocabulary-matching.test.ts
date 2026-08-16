import assert from "node:assert/strict";
import test from "node:test";
import { canonicalVocabularyKey, type IngestionWord } from "../lib/ingestion-utils";
import {
  decideVocabularyMatch,
  levenshteinDistance,
  meaningSimilarity,
  type StoredVocabularyForMatch,
} from "../lib/vocabulary-matching";

function incoming(overrides: Partial<IngestionWord> = {}): IngestionWord {
  return {
    kanji: "食べる",
    kana: "たべる",
    romaji: "taberu",
    burmese_meaning: "စားသည်",
    jlpt_level: "N5",
    ...overrides,
  };
}

function stored(overrides: Partial<StoredVocabularyForMatch> = {}): StoredVocabularyForMatch {
  const word = incoming();
  return {
    id: "v1",
    canonicalKey: canonicalVocabularyKey(word),
    kanji: word.kanji ?? null,
    kana: word.kana,
    burmeseMeaning: word.burmese_meaning,
    partOfSpeech: "verb",
    ...overrides,
  };
}

test("returns exact for the same normalized surface and reading", () => {
  const result = decideVocabularyMatch(
    incoming({ kana: "タベル" }),
    [stored()],
  );
  assert.deepEqual(result, { kind: "exact", existingId: "v1" });
});

test("enriches a single incomplete row with the same normalized reading", () => {
  const result = decideVocabularyMatch(
    incoming(),
    [stored({ canonicalKey: null, kanji: null, kana: "たべる" })],
  );
  assert.equal(result.kind, "enrich");
  assert.equal(result.existingId, "v1");
});

test("does not merge a missing-kanji reading when it has homograph candidates", () => {
  const result = decideVocabularyMatch(
    incoming({ kanji: undefined, kana: "はし", burmese_meaning: "တံတား" }),
    [
      stored({ id: "bridge", canonicalKey: null, kanji: "橋", kana: "はし", burmeseMeaning: "တံတား" }),
      stored({ id: "chopsticks", canonicalKey: null, kanji: "箸", kana: "はし", burmeseMeaning: "တူ" }),
    ],
  );
  assert.deepEqual(result, { kind: "new" });
});

test("queues a review for a one-character OCR reading difference", () => {
  const result = decideVocabularyMatch(
    incoming({ kana: "たべゐる" }),
    [stored()],
  );
  assert.equal(result.kind, "review");
  assert.equal(result.existingId, "v1");
  assert.ok(result.score >= 0.9);
});

test("keeps distinct surface forms separate even when the reading matches", () => {
  const result = decideVocabularyMatch(
    incoming({ kanji: "食べ物", kana: "たべる" }),
    [stored()],
  );
  assert.deepEqual(result, { kind: "new" });
});

test("uses Unicode-aware edit distance and meaning similarity", () => {
  assert.equal(levenshteinDistance("たべる", "たべゐる"), 1);
  assert.equal(meaningSimilarity("စားသည်", "စားသည်"), 1);
  assert.ok(meaningSimilarity("စားသည်", "စားနေသည်") > 0);
});
