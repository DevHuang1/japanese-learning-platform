import { ingestFolder, ensureProgressForAll } from "../lib/pdf-parser";
import { aiProvider } from "../lib/ai";

async function main() {
  if (aiProvider() === "none") {
    console.error(
      "No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env to extract vocabulary from PDFs."
    );
    process.exit(1);
  }
  console.log(`Scanning: ${process.env.PDF_FOLDER ?? "~/Desktop/JLPT-PDFs"}`);
  const result = await ingestFolder();
  const ensured = await ensureProgressForAll();
  console.log(
    `Scanned ${result.scanned.length} PDF(s) — inserted ${result.inserted} word(s), queued ${result.reviewed} fuzzy match review(s).`
  );
  if (result.failed.length) {
    console.log(`Failed files: ${result.failed.join(", ")}`);
  }
  console.log(`Ensured progress records for ${ensured} existing word(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => process.exit(0));
