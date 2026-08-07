import { db } from "../lib/db";

type SeedWord = {
  kanji: string;
  kana: string;
  romaji: string;
  burmese: string;
  level: "N5" | "N4";
  pos: string;
  jp: string;
  mm: string;
};

const SEED: SeedWord[] = [
  { kanji: "食べる", kana: "たべる", romaji: "taberu", burmese: "စားသည်", level: "N5", pos: "動詞", jp: "ご飯を食べます。", mm: "ထမင်းစားသည်။" },
  { kanji: "行く", kana: "いく", romaji: "iku", burmese: "သွားသည်", level: "N5", pos: "動詞", jp: "学校に行きます。", mm: "ကျောင်းသွားသည်။" },
  { kanji: "来る", kana: "くる", romaji: "kuru", burmese: "လာသည်", level: "N5", pos: "動詞", jp: "友達が来ます。", mm: "သူငယ်ချင်းလာသည်။" },
  { kanji: "見る", kana: "みる", romaji: "miru", burmese: "ကြည့်သည်", level: "N5", pos: "動詞", jp: "テレビを見ます。", mm: "ရုပ်မြင်သံကြားကြည့်သည်။" },
  { kanji: "聞く", kana: "きく", romaji: "kiku", burmese: "နားထောင်သည်", level: "N5", pos: "動詞", jp: "音楽を聞きます。", mm: "ဂီတနားထောင်သည်။" },
  { kanji: "大きい", kana: "おおきい", romaji: "ookii", burmese: "ကြီးသည်", level: "N5", pos: "形容詞", jp: "大きい家です。", mm: "အိမ်ကြီးဖြစ်သည်။" },
  { kanji: "小さい", kana: "ちいさい", romaji: "chiisai", burmese: "သေးသည်", level: "N5", pos: "形容詞", jp: "小さい猫です。", mm: "ကြောင်လေးဖြစ်သည်။" },
  { kanji: "新しい", kana: "あたらしい", romaji: "atarashii", burmese: "အသစ်ဖြစ်သည်", level: "N5", pos: "形容詞", jp: "新しい車です。", mm: "ကားအသစ်ဖြစ်သည်။" },
  { kanji: "高い", kana: "たかい", romaji: "takai", burmese: "မြင့်သည်၊ ဈေးကြီးသည်", level: "N5", pos: "形容詞", jp: "この山は高いです。", mm: "ဤတောင်သည် မြင့်သည်။" },
  { kanji: "水", kana: "みず", romaji: "mizu", burmese: "ရေ", level: "N5", pos: "名詞", jp: "水を飲みます。", mm: "ရေသောက်သည်။" },
  { kanji: "友達", kana: "ともだち", romaji: "tomodachi", burmese: "သူငယ်ချင်း", level: "N5", pos: "名詞", jp: "友達と話します。", mm: "သူငယ်ချင်းနှင့် စကားပြောသည်။" },
  { kanji: "先生", kana: "せんせい", romaji: "sensei", burmese: "ဆရာ", level: "N5", pos: "名詞", jp: "先生に聞きます。", mm: "ဆရာအား မေးသည်။" },
  { kanji: "日本", kana: "にほん", romaji: "nihon", burmese: "ဂျပန်", level: "N5", pos: "名詞", jp: "日本に行きたいです。", mm: "ဂျပန်သွားချင်သည်။" },
  { kanji: "学校", kana: "がっこう", romaji: "gakkou", burmese: "ကျောင်း", level: "N5", pos: "名詞", jp: "学校は遠いです。", mm: "ကျောင်းသည် ဝေးသည်။" },
  { kanji: "電車", kana: "でんしゃ", romaji: "densha", burmese: "ရထား (လျှပ်စစ်)", level: "N5", pos: "名詞", jp: "電車で行きます。", mm: "ရထားဖြင့် သွားသည်။" },
  { kanji: "勉強する", kana: "べんきょうする", romaji: "benkyou suru", burmese: "စာကျက်သည်", level: "N5", pos: "動詞", jp: "日本語を勉強します。", mm: "ဂျပန်စာကို စာကျက်သည်။" },
  { kanji: "会う", kana: "あう", romaji: "au", burmese: "တွေ့သည်", level: "N4", pos: "動詞", jp: "駅で友達に会います。", mm: "ဘူတာတွင် သူငယ်ချင်းနှင့်တွေ့သည်။" },
  { kanji: "始まる", kana: "はじまる", romaji: "hajimaru", burmese: "စတင်သည်", level: "N4", pos: "動詞", jp: "授業は九時から始まります。", mm: "သင်ခန်းစာသည် ကိုးနာရီမှစတင်သည်။" },
  { kanji: "難しい", kana: "むずかしい", romaji: "muzukashii", burmese: "ခက်သည်", level: "N5", pos: "形容詞", jp: "その問題は難しいです。", mm: "ထိုပြဿနာသည် ခက်ခဲသည်။" },
  { kanji: "世界", kana: "せかい", romaji: "sekai", burmese: "ကမ္ဘာ့", level: "N4", pos: "名詞", jp: "世界のニュースを見ます。", mm: "ကမ္ဘာ့သတင်းကို ကြည့်သည်။" },
];

async function main() {
  await db.vocabulary.deleteMany();
  await db.userWordProgress.deleteMany();

  for (const w of SEED) {
    const vocab = await db.vocabulary.create({
      data: {
        kanji: w.kanji,
        kana: w.kana,
        romaji: w.romaji,
        burmeseMeaning: w.burmese,
        jlptLevel: w.level,
        partOfSpeech: w.pos,
        exampleSentenceJp: w.jp,
        exampleSentenceMm: w.mm,
        pdfSource: "seed",
      },
    });
    await db.userWordProgress.create({
      data: {
        vocabId: vocab.id,
        nextReviewDate: new Date(Date.now() - 5 * 86400000),
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        status: "learning",
      },
    });
  }

  console.log(`Seeded ${SEED.length} vocabulary entries with progress records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
