import { PrismaClient } from "@prisma/client";
import { vocabularyIdentity } from "../lib/ingestion-utils";

const db = new PrismaClient();

async function main() {
  const rows = await db.vocabulary.findMany({
    select: { id: true, canonicalKey: true, kanji: true, kana: true },
  });
  const groups = new Map<string, typeof rows>();

  for (const row of rows) {
    const key = vocabularyIdentity(row).canonicalKey;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const collisions = [...groups.entries()].filter(([, group]) => group.length > 1);
  if (collisions.length > 0) {
    console.error(`Found ${collisions.length} canonical-key collision group(s). No rows were changed.`);
    for (const [key, group] of collisions) {
      console.error(JSON.stringify({
        canonicalKey: key,
        rows: group.map((row) => ({ id: row.id, kanji: row.kanji, kana: row.kana })),
      }));
    }
    process.exitCode = 1;
    return;
  }

  let updated = 0;
  for (const [canonicalKey, group] of groups) {
    const row = group[0];
    if (row.canonicalKey === canonicalKey) continue;
    await db.vocabulary.update({
      where: { id: row.id },
      data: { canonicalKey },
    });
    updated++;
  }

  console.log(`Backfilled ${updated} vocabulary canonical key(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
