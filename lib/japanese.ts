const KATA_HIRA = new Map<string, string>();
{
  const kata = "ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ";
  const hira = "ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ";
  for (let i = 0; i < kata.length; i++) KATA_HIRA.set(kata[i], hira[i]);
}

export function katakanaToHiragana(s: string): string {
  return s.replace(/[\u30a0-\u30ff]/g, (c) => KATA_HIRA.get(c) ?? c);
}

export function toHiragana(s: string): string {
  return katakanaToHiragana(s);
}

export function normalizeKana(s: string): string {
  return toHiragana(s)
    .replace(/[ぁぃぅぇぉ]/g, (c) => {
      const map: Record<string, string> = { ぁ: "あ", ぃ: "い", ぅ: "う", ぇ: "え", ぉ: "お" };
      return map[c];
    })
    .replace(/[ゃゅょ]/g, (c) => {
      const map: Record<string, string> = { ゃ: "や", ゅ: "ゆ", ょ: "よ" };
      return map[c];
    })
    .replace(/っ/g, "つ");
}

const RO_MAP: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "wo", ん: "n",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
  ゃ: "ya", ゅ: "yu", ょ: "yo", っ: "",
  ゔ: "vu",
};

export function simpleRomaji(kana: string): string {
  const h = toHiragana(kana);
  let out = "";
  for (let i = 0; i < h.length; i++) {
    const ch = h[i];
    const doubled = ch === "っ" && i + 1 < h.length;
    if (doubled) {
      out += (RO_MAP[h[i + 1]] ?? "?")[0] ?? "";
      continue;
    }
    if (ch === "ん") {
      const nxt = h[i + 1];
      if (nxt === "ば" || nxt === "ぱ" || nxt === "ま") out += "m";
      else out += "n";
      continue;
    }
    const nxt = h[i + 1];
    if (["ゃ", "ゅ", "ょ"].includes(nxt ?? "")) {
      const base = RO_MAP[ch] ?? "";
      const ymap: Record<string, string> = { ゃ: "ya", ゅ: "yu", ょ: "yo" };
      out += base.replace(/y$/, "") + (ymap[nxt ?? ""] ?? "");
      i++;
      continue;
    }
    out += RO_MAP[ch] ?? ch;
  }
  return out;
}
