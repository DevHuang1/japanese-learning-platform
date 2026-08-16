import { simpleRomaji, toHiragana } from "./japanese";

export interface IngestionWord {
  kanji?: string;
  kana: string;
  romaji?: string;
  burmese_meaning: string;
  jlpt_level: "N5" | "N4";
  part_of_speech?: string;
  lesson?: number | null;
  example_sentence_jp?: string;
  example_sentence_mm?: string;
}

export interface PdfTextPage {
  num: number;
  text: string;
}

export interface PdfTextChunk {
  text: string;
  pageStart: number;
  pageEnd: number;
  lesson: number | null;
}

const BURMESE_RE = /[\u1000-\u109F\uAA60-\uAA7F]/u;
const JAPANESE_KANA_RE = /[\u3041-\u3096\u30A1-\u30FA\u30FC]/u;

export function normalizePdfText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\u00AD/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeKanaForStorage(value: string): string {
  return toHiragana(value.normalize("NFKC"))
    .replace(/[\s\u3000]+/g, "")
    .replace(/[「」『』【】（）()［］\[\]〈〉<>]/g, "")
    .trim();
}

export function normalizeSurface(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, " ")
    .trim();
}

export function normalizeVocabularySurface(value: string | null | undefined): string {
  return normalizeSurface(value ?? undefined).replace(/[\s\u3000]+/g, "");
}

export interface VocabularyIdentity {
  canonicalKey: string;
  surfaceKey: string;
  readingKey: string;
}

export function vocabularyIdentity(word: {
  kanji?: string | null;
  kana: string;
}): VocabularyIdentity {
  const surfaceKey = normalizeVocabularySurface(word.kanji);
  const readingKey = normalizeKanaForStorage(word.kana);
  return {
    canonicalKey: surfaceKey
      ? `surface:${surfaceKey}\u0000reading:${readingKey}`
      : `reading:${readingKey}`,
    surfaceKey,
    readingKey,
  };
}

export function canonicalVocabularyKey(word: {
  kanji?: string | null;
  kana: string;
}): string {
  return vocabularyIdentity(word).canonicalKey;
}

export function containsBurmese(value: string): boolean {
  return BURMESE_RE.test(value);
}

export function containsJapaneseKana(value: string): boolean {
  return JAPANESE_KANA_RE.test(value);
}

export function detectLessonNumber(text: string): number | null {
  const match = text.normalize("NFKC").match(/(?:第\s*)?(\d{1,2})\s*課|(?:lesson|unit|chapter)\s*(\d{1,2})/iu);
  const lesson = Number(match?.[1] ?? match?.[2]);
  return Number.isInteger(lesson) && lesson >= 1 && lesson <= 25 ? lesson : null;
}

export function detectJlptLevel(text: string): "N5" | "N4" | null {
  const match = text.normalize("NFKC").match(/\b(N[45])\b/iu);
  const level = match?.[1]?.toUpperCase();
  return level === "N4" || level === "N5" ? level : null;
}

function cleanOptionalString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\r\n]+/g, " ")
    .replace(/[ \t\u3000]+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function parseLesson(value: unknown, fallback: number | null): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 25
    ? numeric
    : fallback;
}

function parseJlptLevel(value: unknown, fallback: "N5" | "N4"): "N5" | "N4" {
  const level = typeof value === "string" ? value.toUpperCase() : "";
  return level === "N4" || level === "N5" ? level : fallback;
}

export function normalizeExtractedWord(
  value: unknown,
  defaults: { jlptLevel?: "N5" | "N4"; lesson?: number | null } = {},
): IngestionWord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const rawKana = typeof raw.kana === "string" ? raw.kana : "";
  const kana = normalizeKanaForStorage(rawKana);
  const meaning = cleanOptionalString(raw.burmese_meaning, 300);

  if (!kana || !containsJapaneseKana(kana) || !meaning || !containsBurmese(meaning)) {
    return null;
  }

  const kanji = cleanOptionalString(raw.kanji, 80);
  const romaji = cleanOptionalString(raw.romaji, 120) ?? simpleRomaji(kana);
  const partOfSpeech = cleanOptionalString(raw.part_of_speech, 80);
  const exampleSentenceJp = cleanOptionalString(raw.example_sentence_jp, 300);
  const exampleSentenceMm = cleanOptionalString(raw.example_sentence_mm, 300);

  return {
    kanji,
    kana,
    romaji,
    burmese_meaning: meaning,
    jlpt_level: parseJlptLevel(raw.jlpt_level, defaults.jlptLevel ?? "N5"),
    part_of_speech: partOfSpeech,
    lesson: parseLesson(raw.lesson, defaults.lesson ?? null),
    example_sentence_jp: exampleSentenceJp,
    example_sentence_mm: exampleSentenceMm,
  };
}

function splitLongLine(line: string, maxChars: number): string[] {
  const parts: string[] = [];
  let remaining = line;

  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const boundaryMatches = [...window.matchAll(/[。！？!?、；;:：]/gu)];
    const lastBoundary = boundaryMatches.at(-1)?.index;
    const cut = lastBoundary !== undefined && lastBoundary >= Math.floor(maxChars * 0.45)
      ? lastBoundary + 1
      : maxChars;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining) parts.push(remaining);
  return parts;
}

export function chunkPdfPages(
  pages: PdfTextPage[],
  maxChars = 4200,
): PdfTextChunk[] {
  const chunks: PdfTextChunk[] = [];
  let currentLines: string[] = [];
  let currentChars = 0;
  let pageStart = 0;
  let pageEnd = 0;
  let currentLesson: number | null = null;
  let activeLesson: number | null = null;

  const flush = () => {
    if (currentLines.length === 0) return;
    const context = [
      `PDF_PAGE: ${pageStart}${pageEnd !== pageStart ? `-${pageEnd}` : ""}`,
      currentLesson ? `LESSON_CONTEXT: ${currentLesson}` : "",
    ].filter(Boolean).join("\n");
    chunks.push({
      text: `${context}\n\n${currentLines.join("\n")}`,
      pageStart,
      pageEnd,
      lesson: currentLesson,
    });
    currentLines = [];
    currentChars = 0;
    pageStart = 0;
    pageEnd = 0;
    currentLesson = null;
  };

  for (const page of pages) {
    const text = normalizePdfText(page.text);
    if (!text) continue;

    const pageLesson = detectLessonNumber(text);
    if (pageLesson !== null) activeLesson = pageLesson;

    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const pieces = splitLongLine(line, maxChars);

      for (const piece of pieces) {
        if (currentLines.length > 0 && currentChars + piece.length + 1 > maxChars) {
          flush();
        }
        if (currentLines.length === 0) {
          pageStart = page.num;
          currentLesson = activeLesson;
        }
        currentLines.push(piece);
        currentChars += piece.length + 1;
        pageEnd = page.num;
      }
    }
  }

  flush();
  return chunks;
}

export function chunkText(text: string, maxChars = 4200): string[] {
  return chunkPdfPages([{ num: 1, text }], maxChars).map((chunk) => chunk.text);
}
