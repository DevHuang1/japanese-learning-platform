import path from "node:path";
import { db } from "@/lib/db";

async function main() {
  await db.ingestionBatch.deleteMany({ where: { sourceName: { startsWith: "playwright-ingestion-" } } });
  await db.vocabularyMatchReview.deleteMany({ where: { source: { startsWith: "ingestion-page:" } } });
  await db.vocabulary.deleteMany({ where: { pdfSource: { startsWith: "ingestion-page:" } } });
  const sourceImagePath = path.join(process.cwd(), "tests/fixtures/ingestion/ocr-page.png");
  const batch = await db.ingestionBatch.create({
    data: {
      sourceName: "playwright-ingestion-scanned.pdf",
      status: "needs_review",
      totalPages: 1,
      ocrPages: 1,
      extractedCandidates: 0,
      selectablePages: 0,
    },
  });
  const page = await db.ingestionPage.create({
    data: {
      batchId: batch.id,
      pageNumber: 1,
      mode: "ocr",
      status: "needs_review",
      sourceImagePath,
      rawText: "校正 こうせい စာပြင်ဆင်ခြင်း",
      normalizedText: "校正 こうせい စာပြင်ဆင်ခြင်း",
      ocrLanguages: "jpn+mya",
      ocrConfidence: 0.87,
    },
  });
  console.log(JSON.stringify({ batchId: batch.id, pageId: page.id }));
  await db.$disconnect();
}

void main();
