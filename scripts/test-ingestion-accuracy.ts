import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { extractPdfPages } from "@/lib/pdf-parser";
import {
  chunkPdfPages,
  detectJlptLevel,
  detectLessonNumber,
  normalizeExtractedWord,
  normalizePdfText,
} from "@/lib/ingestion-utils";
import { decideVocabularyMatch, type StoredVocabularyForMatch } from "@/lib/vocabulary-matching";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const manifestPath = process.env.JLPT_ACCURACY_MANIFEST ?? path.join(root, "tests/fixtures/jlpt/manifest.json");
const outputPath = process.env.JLPT_ACCURACY_OUTPUT ?? path.join(root, "artifacts/ingestion-accuracy.json");

type OcrAssertions = {
  languages?: string;
  requiredText?: string[];
  expectedJlpt?: "N5" | "N4";
  expectedLesson?: number;
  minimumCharacters?: number;
};

type Manifest = {
  pdfSamples?: Array<{
    id: string;
    path: string;
    minimumPages?: number;
    requiredText?: string[];
    expectedJlpt?: "N5" | "N4";
    expectedLesson?: number;
    expectNoSelectableText?: boolean;
    ocr?: OcrAssertions;
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

async function runOcr(filePath: string, languages: string) {
  const workdir = await mkdtemp(path.join(os.tmpdir(), "wagaku-ocr-"));
  try {
    const imagePrefix = path.join(workdir, "page");
    await execFileAsync("pdftoppm", ["-png", "-r", "200", filePath, imagePrefix]);
    const images = (await readdir(workdir))
      .filter((file) => file.endsWith(".png"))
      .sort()
      .map((file) => path.join(workdir, file));
    const outputs = await Promise.all(
      images.map(async (image) => {
        const result = await execFileAsync("tesseract", [image, "stdout", "-l", languages, "--psm", "6"], {
          maxBuffer: 4 * 1024 * 1024,
        });
        return result.stdout;
      }),
    );
    return { pages: images.length, text: outputs.join("\n") };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function summarizePdf(sample: NonNullable<Manifest["pdfSamples"]>[number]) {
  const filePath = path.isAbsolute(sample.path) ? sample.path : path.resolve(root, sample.path);
  try {
    const pages = await extractPdfPages(filePath);
    const text = pages.map((page) => normalizePdfText(page.text)).join("\n");
    const chunks = chunkPdfPages(pages);
    const missingText = (sample.requiredText ?? []).filter((expected) => !text.includes(expected));
    const selectablePageExpectation = sample.expectNoSelectableText
      ? pages.length === 0
      : pages.length >= (sample.minimumPages ?? 1);
    const selectablePassed =
      selectablePageExpectation &&
      missingText.length === 0 &&
      (!sample.expectedJlpt || detectJlptLevel(text) === sample.expectedJlpt) &&
      (!sample.expectedLesson || detectLessonNumber(text) === sample.expectedLesson);

    let ocrResult: Record<string, unknown> | undefined;
    let ocrPassed = true;
    if (sample.ocr) {
      try {
        const languages = sample.ocr.languages ?? "jpn+eng";
        const ocr = await runOcr(filePath, languages);
        const ocrText = normalizePdfText(ocr.text);
        const missingOcrText = (sample.ocr.requiredText ?? []).filter((expected) => !ocrText.includes(expected));
        ocrPassed =
          missingOcrText.length === 0 &&
          ocrText.length >= (sample.ocr.minimumCharacters ?? 1) &&
          (!sample.ocr.expectedJlpt || detectJlptLevel(ocrText) === sample.ocr.expectedJlpt) &&
          (!sample.ocr.expectedLesson || detectLessonNumber(ocrText) === sample.ocr.expectedLesson);
        ocrResult = {
          passed: ocrPassed,
          languages,
          pages: ocr.pages,
          characters: ocrText.length,
          missingText: missingOcrText,
          detectedJlpt: detectJlptLevel(ocrText),
          detectedLesson: detectLessonNumber(ocrText),
          text: ocrText,
        };
      } catch (error) {
        ocrPassed = false;
        ocrResult = {
          passed: false,
          reason: error instanceof Error ? error.message : "OCR command failed",
        };
      }
    }

    const passed = selectablePassed && ocrPassed;
    return {
      id: sample.id,
      path: sample.path,
      passed,
      pages: pages.length,
      chunks: chunks.length,
      characters: text.length,
      missingText,
      selectableText: pages.length > 0,
      expectNoSelectableText: sample.expectNoSelectableText ?? false,
      detectedJlpt: detectJlptLevel(text),
      detectedLesson: detectLessonNumber(text),
      ocr: ocrResult,
      reason: passed ? undefined : "PDF did not meet its declared extraction or OCR expectations",
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
      selectableText: false,
      expectNoSelectableText: sample.expectNoSelectableText ?? false,
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
    manifestPath: path.relative(root, manifestPath) || path.basename(manifestPath),
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
