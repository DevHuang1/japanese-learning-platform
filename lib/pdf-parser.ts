import fs from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
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
import {
  decideVocabularyMatch,
  type StoredVocabularyForMatch,
} from "./vocabulary-matching";

const DEFAULT_MAX_PDF_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_PDF_PAGES = 250;
const DEFAULT_CHUNK_CHARS = 4200;

type StoredVocabularyRow = StoredVocabularyForMatch;

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

function vocabularySelect() {
  return {
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
  } as const;
}

async function enrichExistingVocabulary(
  existing: StoredVocabularyRow,
  incoming: ExtractedWord,
  canonicalKey: string,
): Promise<void> {
  const data: Prisma.VocabularyUpdateInput = {};
  if (!existing.canonicalKey) data.canonicalKey = canonicalKey;
  if (!existing.kanji && incoming.kanji) data.kanji = incoming.kanji;
  if (!existing.romaji && incoming.romaji) data.romaji = incoming.romaji;
  if (!existing.partOfSpeech && incoming.part_of_speech) {
    data.partOfSpeech = incoming.part_of_speech;
  }
  if (!existing.exampleSentenceJp && incoming.example_sentence_jp) {
    data.exampleSentenceJp = incoming.example_sentence_jp;
  }
  if (!existing.exampleSentenceMm && incoming.example_sentence_mm) {
    data.exampleSentenceMm = incoming.example_sentence_mm;
  }
  if (!existing.lesson && incoming.lesson) data.lesson = incoming.lesson;

  if (Object.keys(data).length > 0) {
    await db.vocabulary.update({ where: { id: existing.id }, data });
  }
}

async function saveMatchReview(
  incoming: ExtractedWord,
  candidateId: string,
  score: number,
  reasons: string[],
  pdfSource: string,
): Promise<void> {
  const reviewKey = `${candidateId}\u0000${canonicalVocabularyKey(incoming)}`;
  await db.vocabularyMatchReview.upsert({
    where: { reviewKey },
    update: {},
    create: {
      reviewKey,
      incomingJson: JSON.stringify(incoming),
      candidateId,
      score,
      reasonsJson: JSON.stringify(reasons),
      source: pdfSource,
    },
  });
}

export async function upsertWords(
  words: ExtractedWord[],
  pdfSource: string,
): Promise<{ inserted: number; reviewed: number }> {
  let inserted = 0;
  let reviewed = 0;
  const batch = new Map<string, ExtractedWord>();

  for (const rawWord of words) {
    const word = normalizeExtractedWord(rawWord);
    if (!word) continue;
    const key = canonicalVocabularyKey(word);
    if (!batch.has(key)) batch.set(key, word);
  }

  const wordsToProcess = [...batch.values()];
  if (wordsToProcess.length === 0) return { inserted, reviewed };

  const canonicalKeys = [...new Set(wordsToProcess.map(canonicalVocabularyKey))];
  const kanaValues = [
    ...new Set(wordsToProcess.map((word) => normalizeKanaForStorage(word.kana))),
  ];
  const kanjiValues = [
    ...new Set(
      wordsToProcess
        .map((word) => normalizeSurface(word.kanji))
        .filter((value) => value.length > 0),
    ),
  ];
  const lookupConditions: Prisma.VocabularyWhereInput[] = [
    { canonicalKey: { in: canonicalKeys } },
    { kana: { in: kanaValues } },
  ];
  if (kanjiValues.length > 0) lookupConditions.push({ kanji: { in: kanjiValues } });

  const existingRows = (await db.vocabulary.findMany({
    where: { OR: lookupConditions },
    select: vocabularySelect(),
  })) as StoredVocabularyRow[];

  for (const incoming of wordsToProcess) {
    const canonicalKey = canonicalVocabularyKey(incoming);
    const decision = decideVocabularyMatch(incoming, existingRows);

    if (decision.kind === "exact" || decision.kind === "enrich") {
      const existing = existingRows.find((row) => row.id === decision.existingId);
      if (existing) {
        await enrichExistingVocabulary(existing, incoming, canonicalKey);
      }
      continue;
    }

    if (decision.kind === "review") {
      await saveMatchReview(
        incoming,
        decision.existingId,
        decision.score,
        decision.reasons,
        pdfSource,
      );
      reviewed++;
      continue;
    }

    try {
      const created = await db.vocabulary.create({
        data: {
          canonicalKey,
          kanji: normalizeSurface(incoming.kanji) || null,
          kana: normalizeKanaForStorage(incoming.kana),
          romaji: incoming.romaji || null,
          burmeseMeaning: incoming.burmese_meaning,
          jlptLevel: incoming.jlpt_level,
          partOfSpeech: incoming.part_of_speech || null,
          exampleSentenceJp: incoming.example_sentence_jp || null,
          exampleSentenceMm: incoming.example_sentence_mm || null,
          lesson: incoming.lesson ?? null,
          pdfSource,
        },
        select: vocabularySelect(),
      });
      existingRows.push(created as StoredVocabularyRow);
      inserted++;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }

      const winner = (await db.vocabulary.findUnique({
        where: { canonicalKey },
        select: vocabularySelect(),
      })) as StoredVocabularyRow | null;
      if (!winner) throw error;
      await enrichExistingVocabulary(winner, incoming, canonicalKey);
    }
  }

  return { inserted, reviewed };
}

export async function ingestFolder(folder?: string): Promise<{
  scanned: string[];
  inserted: number;
  reviewed: number;
  failed: string[];
}> {
  const target = folder ?? pdfFolder();
  const pdfs = await listPdfs(target);
  let inserted = 0;
  let reviewed = 0;
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
        const result = await upsertWords(
          await aiExtractVocabulary(chunk.text),
          path.basename(file),
        );
        inserted += result.inserted;
        reviewed += result.reviewed;
      }
    } catch (error) {
      failed.push(path.basename(file));
      console.error(`[pdf-parser] failed ${file}:`, error);
    }
  }

  return { scanned: pdfs.map((p) => path.basename(p)), inserted, reviewed, failed };
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
