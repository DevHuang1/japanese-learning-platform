import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.vocabularyMatchReview.deleteMany({
    where: { source: { startsWith: "playwright-" } },
  });
  await db.vocabulary.deleteMany({
    where: { pdfSource: { startsWith: "playwright-" } },
  });

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
        "compatible Burmese meaning (100%)",
      ]),
      explanationJson: JSON.stringify({
        summary: "The Japanese surface agrees and the reading differs by one character, which is consistent with a possible OCR error.",
        confidence: "high",
        signals: [
          { label: "Kanji surface", value: "exact normalized match", weight: 0.55, positive: true },
          { label: "Kana reading", value: "edit distance 1", weight: 0.25, positive: false },
          { label: "Burmese meaning", value: "100% character-bigram similarity", weight: 0.2, positive: true },
        ],
        normalizedIncoming: { surface: "検証", reading: "けんしょゐ" },
        normalizedCandidate: { surface: "検証", reading: "けんしょう" },
        collisionRisk: "medium",
      }),
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
        "compatible Burmese meaning (100%)",
      ]),
      explanationJson: JSON.stringify({
        summary: "The Japanese surface agrees and the reading differs by one character, which is consistent with a possible OCR error.",
        confidence: "high",
        signals: [
          { label: "Kanji surface", value: "exact normalized match", weight: 0.55, positive: true },
          { label: "Kana reading", value: "edit distance 1", weight: 0.25, positive: false },
          { label: "Burmese meaning", value: "100% character-bigram similarity", weight: 0.2, positive: true },
        ],
        normalizedIncoming: { surface: "検証", reading: "けんしょゐ" },
        normalizedCandidate: { surface: "検証", reading: "けんしょう" },
        collisionRisk: "medium",
      }),
    },
  ];

  await db.vocabulary.upsert({
    where: { canonicalKey: "surface:重複\u0000reading:ちょうふく" },
    update: {},
    create: {
      canonicalKey: "surface:重複\u0000reading:ちょうふく",
      kanji: "重複",
      kana: "ちょうふく",
      romaji: "choufuku",
      burmeseMeaning: "ထပ်နေခြင်း",
      jlptLevel: "N3",
      partOfSpeech: "noun",
      pdfSource: "playwright-collision-kept.pdf",
    },
  });
  await db.vocabulary.create({
    data: {
      canonicalKey: null,
      kanji: "重複",
      kana: "ちょうふく",
      romaji: "choufuku",
      burmeseMeaning: "ထပ်နေခြင်း",
      jlptLevel: "N3",
      partOfSpeech: "noun",
      pdfSource: "playwright-collision.pdf",
    },
  });

  for (const collision of [
    {
      key: "surface:別重複\u0000reading:べつちょうふく",
      kanji: "別重複",
      kana: "べつちょうふく",
      romaji: "betsuchoufuku",
      meaning: "ထပ်နေသောအခြားအရာ",
      source: "playwright-collision-two.pdf",
    },
    {
      key: "surface:三重複\u0000reading:さんちょうふく",
      kanji: "三重複",
      kana: "さんちょうふく",
      romaji: "sanchoufuku",
      meaning: "သုံးကြိမ်ထပ်နေခြင်း",
      source: "playwright-collision-three.pdf",
    },
  ]) {
    await db.vocabulary.upsert({
      where: { canonicalKey: collision.key },
      update: {},
      create: {
        canonicalKey: collision.key,
        kanji: collision.kanji,
        kana: collision.kana,
        romaji: collision.romaji,
        burmeseMeaning: collision.meaning,
        jlptLevel: "N3",
        partOfSpeech: "noun",
        pdfSource: `${collision.source}-kept`,
      },
    });
    await db.vocabulary.create({
      data: {
        canonicalKey: null,
        kanji: collision.kanji,
        kana: collision.kana,
        romaji: collision.romaji,
        burmeseMeaning: collision.meaning,
        jlptLevel: "N3",
        partOfSpeech: "noun",
        pdfSource: collision.source,
      },
    });
  }

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
