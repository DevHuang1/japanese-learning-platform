import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";
import { db } from "./db";
import { aiExtractVocabulary, type ExtractedWord } from "./ai";
import {
  canonicalVocabularyKey,
  chunkPdfPages,
  normalizeExtractedWord,
  normalizeKanaForStorage,
  normalizeSurface,
  type PdfTextPage,
} from "./ingestion-utils";

const DEFAULT_MAX_PDF_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_PDF_PAGES = 250;
const DEFAULT_CHUNK_CHARS = 4200;

function positiveEnvInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function pdfFolder(): string {
  return (
    process.env.PDF_FOLDER ??
    path.join(process.env.HOME ?? "", "Desktop", "JLPT-PDFs")
  );
}

export async function listPdfs(folder = pdfFolder()): Promise<string[]> {
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
      .map((entry) => path.join(folder, entry.name))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function extractPdfPages(filePath: string): Promise<PdfTextPage[]> {
  const stat = await fs.stat(filePath);
  const maxBytes = positiveEnvInt("PDF_MAX_BYTES", DEFAULT_MAX_PDF_BYTES);
  if (stat.size > maxBytes) {
    throw new Error(`PDF exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB size limit`);
  }

  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const maxPages = positiveEnvInt("PDF_MAX_PAGES", DEFAULT_MAX_PDF_PAGES);
    if (result.pages.length > maxPages) {
      throw new Error(`PDF exceeds the ${maxPages}-page limit`);
    }
    return result.pages
      .map((page) => ({ num: page.num, text: page.text }))
      .filter((page) => page.text.trim().length > 0);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function extractPdfText(filePath: string): Promise<string> {
  const pages = await extractPdfPages(filePath);
  return pages.map((page) => page.text).join("\n\n");
}

function sameVocabulary(
  existing: { kanji: string | null; kana: string },
  incoming: { kanji?: string; kana: string },
): boolean {
  const existingKey = canonicalVocabularyKey(existing);
  const incomingKey = canonicalVocabularyKey(incoming);
  if (existingKey === incomingKey) return true;

  // A previous import may have stored a reading without kanji. Treat it as
  // the same entry once a later import supplies the kanji surface form.
  return (
    (!existing.kanji || !incoming.kanji) &&
    normalizeKanaForStorage(existing.kana) === normalizeKanaForStorage(incoming.kana)
  );
}

export async function upsertWords(
  words: ExtractedWord[],
  pdfSource: string,
): Promise<number> {
  let inserted = 0;
  const batch = new Map<string, ExtractedWord>();

  for (const rawWord of words) {
    const word = normalizeExtractedWord(rawWord);
    if (!word) continue;
    const key = canonicalVocabularyKey(word);
    if (!batch.has(key)) batch.set(key, word);
  }

  const wordsToInsert = [...batch.values()];
  if (wordsToInsert.length === 0) return 0;

  const kanaValues = [...new Set(wordsToInsert.map((word) => normalizeKanaForStorage(word.kana)))];
  const existingRows = await db.vocabulary.findMany({
    where: { kana: { in: kanaValues } },
    select: {
      id: true,
      kanji: true,
      kana: true,
      romaji: true,
      burmeseMeaning: true,
      jlptLevel: true,
      partOfSpeech: true,
      exampleSentenceJp: true,
      exampleSentenceMm: true,
      lesson: true,
    },
  });

  for (const w of wordsToInsert) {
    const kana = normalizeKanaForStorage(w.kana);
    const kanji = normalizeSurface(w.kanji);
    const existing = existingRows.find((row) => sameVocabulary(row, { kanji, kana }));

    if (existing) {
      const updates: Record<string, string | number | null> = {};
      if (!existing.kanji && kanji) updates.kanji = kanji;
      if (!existing.romaji && w.romaji) updates.romaji = w.romaji;
      if (!existing.partOfSpeech && w.part_of_speech) updates.partOfSpeech = w.part_of_speech;
      if (!existing.exampleSentenceJp && w.example_sentence_jp) {
        updates.exampleSentenceJp = w.example_sentence_jp;
      }
      if (!existing.exampleSentenceMm && w.example_sentence_mm) {
        updates.exampleSentenceMm = w.example_sentence_mm;
      }
      if (!existing.lesson && w.lesson) updates.lesson = w.lesson;
      if (Object.keys(updates).length > 0) {
        await db.vocabulary.update({ where: { id: existing.id }, data: updates });
      }
      continue;
    }

    try {
      await db.vocabulary.create({
        data: {
          kanji: kanji || null,
          kana,
          romaji: w.romaji || null,
          burmeseMeaning: w.burmese_meaning,
          jlptLevel: w.jlpt_level,
          partOfSpeech: w.part_of_speech || null,
          exampleSentenceJp: w.example_sentence_jp || null,
          exampleSentenceMm: w.example_sentence_mm || null,
          lesson: w.lesson ?? null,
          pdfSource,
        },
      });
      inserted++;
    } catch {
      // Another import can insert the same reading between the lookup and create.
    }
  }
  return inserted;
}

export async function ingestFolder(folder?: string): Promise<{
  scanned: string[];
  inserted: number;
  failed: string[];
}> {
  const target = folder ?? pdfFolder();
  const pdfs = await listPdfs(target);
  let inserted = 0;
  const failed: string[] = [];
  const chunkChars = positiveEnvInt("PDF_CHUNK_CHARS", DEFAULT_CHUNK_CHARS);

  for (const file of pdfs) {
    try {
      const pages = await extractPdfPages(file);
      const chunks = chunkPdfPages(pages, chunkChars);
      if (chunks.length === 0) {
        throw new Error("No extractable text found. Scanned-image PDFs require OCR before ingestion.");
      }

      for (const chunk of chunks) {
        const words = await aiExtractVocabulary(chunk.text);
        inserted += await upsertWords(words, path.basename(file));
      }
    } catch (error) {
      failed.push(path.basename(file));
      console.error(`[pdf-parser] failed ${file}:`, error);
    }
  }

  return { scanned: pdfs.map((p) => path.basename(p)), inserted, failed };
}

export async function ensureProgressForAll(): Promise<number> {
  const vocabs = await db.vocabulary.findMany({
    where: { progress: null },
    select: { id: true },
  });
  if (vocabs.length === 0) return 0;

  await db.$transaction(
    vocabs.map((v) =>
      db.userWordProgress.create({
        data: { vocabId: v.id },
      }),
    ),
  );
  return vocabs.length;
}
