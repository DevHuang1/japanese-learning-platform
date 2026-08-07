import { promises as fs } from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import { db } from "./db";
import { aiExtractVocabulary, type ExtractedWord } from "./ai";

export function pdfFolder(): string {
  return (
    process.env.PDF_FOLDER ??
    path.join(process.env.HOME ?? "", "Desktop", "JLPT-PDFs")
  );
}

export async function listPdfs(folder = pdfFolder()): Promise<string[]> {
  try {
    const entries = await fs.readdir(folder);
    return entries
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .map((f) => path.join(folder, f));
  } catch {
    return [];
  }
}

export async function extractPdfText(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  return result?.text ?? "";
}

function chunkText(text: string, size = 4000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.filter((c) => c.trim().length > 0);
}

export async function upsertWords(
  words: ExtractedWord[],
  pdfSource: string
): Promise<number> {
  let inserted = 0;
  for (const w of words) {
    const kana = w.kana.trim();
    if (!kana) continue;
    const existing = await db.vocabulary.findFirst({
      where: {
        kana,
        ...(w.kanji ? { kanji: w.kanji } : {}),
      },
    });
    if (existing) continue;
    try {
      await db.vocabulary.create({
        data: {
          kanji: w.kanji || null,
          kana,
          romaji: w.romaji || null,
          burmeseMeaning: w.burmese_meaning,
          jlptLevel: w.jlpt_level,
          partOfSpeech: w.part_of_speech || null,
          exampleSentenceJp: w.example_sentence_jp || null,
          exampleSentenceMm: w.example_sentence_mm || null,
          pdfSource,
        },
      });
      inserted++;
    } catch {
      // duplicate race — skip
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

  for (const file of pdfs) {
    try {
      const text = await extractPdfText(file);
      const chunks = chunkText(text);
      for (const chunk of chunks) {
        const words = await aiExtractVocabulary(chunk);
        inserted += await upsertWords(words, path.basename(file));
      }
    } catch (e) {
      failed.push(path.basename(file));
      console.error(`[pdf-parser] failed ${file}:`, e);
    }
  }

  return { scanned: pdfs.map((p) => path.basename(p)), inserted, failed };
}

export async function ensureProgressForAll(): Promise<number> {
  const vocabs = await db.vocabulary.findMany({
    where: { progress: null },
    select: { id: true },
  });
  for (const v of vocabs) {
    await db.userWordProgress.create({
      data: { vocabId: v.id },
    });
  }
  return vocabs.length;
}
