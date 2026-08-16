import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const existing = await db.vocabulary.upsert({
    where: { canonicalKey: "surface:検証\u0000reading:けんしょう" },
    update: {},
    create: {
      canonicalKey: "surface:検証\u0000reading:けんしょう",
      kanji: "検証",
      kana: "けんしょう",
      romaji: "kenshou",
      burmeseMeaning: "စစ်ဆေးအတည်ပြုသည်",
      jlptLevel: "N4",
      partOfSpeech: "noun",
      pdfSource: "playwright-fixture",
    },
  });

  const fixtures = [
    {
      reviewKey: "playwright-accept-review",
      incomingJson: JSON.stringify({
        kanji: "検証",
        kana: "けんしょゐ",
        romaji: "kenshou",
        burmese_meaning: "စစ်ဆေးအတည်ပြုသည်",
        jlpt_level: "N4",
      }),
      score: 0.91,
      reasonsJson: JSON.stringify([
        "same normalized kanji surface",
        "kana edit distance 1",
        "compatible Burmese meaning",
      ]),
    },
    {
      reviewKey: "playwright-reject-review",
      incomingJson: JSON.stringify({
        kanji: "検証",
        kana: "けんしょゐ",
        romaji: "kenshou",
        burmese_meaning: "စစ်ဆေးအတည်ပြုသည်",
        jlpt_level: "N4",
      }),
      score: 0.91,
      reasonsJson: JSON.stringify([
        "same normalized kanji surface",
        "kana edit distance 1",
        "compatible Burmese meaning",
      ]),
    },
  ];

  for (const fixture of fixtures) {
    await db.vocabularyMatchReview.create({
      data: {
        ...fixture,
        candidateId: existing.id,
        source: fixture.reviewKey === "playwright-accept-review"
        ? "playwright-accept.pdf"
        : "playwright-reject.pdf",
        status: "pending",
      },
    });
  }
  console.log(`Seeded ${fixtures.length} pending review fixtures.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
