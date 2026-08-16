import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractPdfPages } from "@/lib/pdf-parser";
import {
  chunkPdfPages,
  detectJlptLevel,
  detectLessonNumber,
  normalizeExtractedWord,
  normalizePdfText,
} from "@/lib/ingestion-utils";
import { decideVocabularyMatch, type StoredVocabularyForMatch } from "@/lib/vocabulary-matching";

const root = process.cwd();
const manifestPath = process.env.JLPT_ACCURACY_MANIFEST ?? path.join(root, "tests/fixtures/jlpt/manifest.json");
const outputPath = process.env.JLPT_ACCURACY_OUTPUT ?? path.join(root, "artifacts/ingestion-accuracy.json");

type Manifest = {
  pdfSamples?: Array<{
    id: string;
    path: string;
    minimumPages?: number;
    requiredText?: string[];
    expectedJlpt?: "N5" | "N4";
    expectedLesson?: number;
  }>;
  matchCases: Array<{
    id: string;
    incoming: unknown;
    existing: StoredVocabularyForMatch[];
    expectedKind: "exact" | "enrich" | "review" | "new";
    minimumScore?: number;
  }>;
};

function summarizeCase(item: Manifest["matchCases"][number]) {
  const incoming = normalizeExtractedWord(item.incoming);
  if (!incoming) {
    return { id: item.id, passed: false, expected: item.expectedKind, actual: "invalid", reason: "Incoming fixture failed vocabulary validation" };
  }
  const result = decideVocabularyMatch(incoming, item.existing);
  const passedKind = result.kind === item.expectedKind;
  const passedScore = result.kind !== "review" || result.score >= (item.minimumScore ?? 0);
  return {
    id: item.id,
    passed: passedKind && passedScore,
    expected: item.expectedKind,
    actual: result.kind,
    score: result.kind === "review" ? result.score : undefined,
    reason: passedKind && passedScore ? undefined : `Expected ${item.expectedKind}${item.minimumScore ? ` with score >= ${item.minimumScore}` : ""}`,
  };
}

async function summarizePdf(sample: NonNullable<Manifest["pdfSamples"]>[number]) {
  const filePath = path.isAbsolute(sample.path) ? sample.path : path.resolve(root, sample.path);
  try {
    const pages = await extractPdfPages(filePath);
    const text = pages.map((page) => normalizePdfText(page.text)).join("\n");
    const chunks = chunkPdfPages(pages);
    const missingText = (sample.requiredText ?? []).filter((expected) => !text.includes(expected));
    const passed =
      pages.length >= (sample.minimumPages ?? 1) &&
      missingText.length === 0 &&
      (!sample.expectedJlpt || detectJlptLevel(text) === sample.expectedJlpt) &&
      (!sample.expectedLesson || detectLessonNumber(text) === sample.expectedLesson);
    return {
      id: sample.id,
      path: sample.path,
      passed,
      pages: pages.length,
      chunks: chunks.length,
      characters: text.length,
      missingText,
      detectedJlpt: detectJlptLevel(text),
      detectedLesson: detectLessonNumber(text),
      reason: passed ? undefined : "PDF did not meet its declared extraction expectations",
    };
  } catch (error) {
    return {
      id: sample.id,
      path: sample.path,
      passed: false,
      pages: 0,
      chunks: 0,
      characters: 0,
      missingText: [],
      reason: error instanceof Error ? error.message : "PDF extraction failed",
    };
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  const matchResults = manifest.matchCases.map(summarizeCase);
  const pdfResults = await Promise.all((manifest.pdfSamples ?? []).map(summarizePdf));
  const checks = [...matchResults, ...pdfResults];
  const passed = checks.filter((check) => check.passed).length;
  const report = {
    generatedAt: new Date().toISOString(),
    manifestPath,
    passed,
    failed: checks.length - passed,
    total: checks.length,
    accuracy: checks.length === 0 ? 1 : passed / checks.length,
    matchResults,
    pdfResults,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (report.failed > 0) process.exitCode = 1;
}

void main();
