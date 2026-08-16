import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalVocabularyKey,
  chunkPdfPages,
  containsBurmese,
  detectJlptLevel,
  detectLessonNumber,
  normalizeExtractedWord,
  normalizeKanaForStorage,
  normalizePdfText,
} from "../lib/ingestion-utils";

test("normalizes common PDF whitespace and invisible characters", () => {
  const result = normalizePdfText("第１課\r\n\u200b すし   を   食べます \r\n\r\n\r\n");
  assert.equal(result, "第1課\nすし を 食べます");
});

test("normalizes katakana readings to hiragana without collapsing meaning-bearing kana", () => {
  assert.equal(normalizeKanaForStorage("スーパー"), "すーぱー");
  assert.equal(normalizeKanaForStorage("  たべます  "), "たべます");
});

test("detects lesson and JLPT context from Japanese and English headers", () => {
  assert.equal(detectLessonNumber("みんなの日本語 第１２課"), 12);
  assert.equal(detectLessonNumber("Lesson 4 vocabulary"), 4);
  assert.equal(detectJlptLevel("JLPT N4 reading"), "N4");
  assert.equal(detectJlptLevel("beginner list"), null);
});

test("chunks pages at line and sentence boundaries while preserving page and lesson context", () => {
  const chunks = chunkPdfPages([
    { num: 1, text: "第1課\nすし\nこれは長い文です。次の文です。" },
    { num: 2, text: "食べます\nおいしいです。" },
  ], 18);

  assert.ok(chunks.length >= 2);
  assert.match(chunks[0].text, /PDF_PAGE: 1/);
  assert.match(chunks[0].text, /LESSON_CONTEXT: 1/);
  assert.ok(chunks.every((chunk) => chunk.text.length > 0));
  assert.ok(chunks.every((chunk) => chunk.text.includes("PDF_PAGE:")));
});

test("accepts valid Japanese-Burmese vocabulary and fills missing romaji", () => {
  const word = normalizeExtractedWord({
    kanji: "食べる",
    kana: "タベル",
    burmese_meaning: "စားသည်",
    jlpt_level: "N5",
  });

  assert.ok(word);
  assert.equal(word?.kana, "たべる");
  assert.equal(word?.romaji, "taberu");
  assert.equal(word?.jlpt_level, "N5");
  assert.equal(containsBurmese(word?.burmese_meaning ?? ""), true);
});

test("rejects malformed model output without Japanese reading or Burmese meaning", () => {
  assert.equal(normalizeExtractedWord({ kana: "hello", burmese_meaning: "စားသည်" }), null);
  assert.equal(normalizeExtractedWord({ kana: "たべる", burmese_meaning: "to eat" }), null);
  assert.equal(normalizeExtractedWord({ kana: "たべる" }), null);
});

test("uses a stable key for equivalent kana representations", () => {
  assert.equal(
    canonicalVocabularyKey({ kanji: "食べる", kana: "たべる" }),
    canonicalVocabularyKey({ kanji: "食べる", kana: "タベル" }),
  );
});
