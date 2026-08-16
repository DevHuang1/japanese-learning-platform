import {
  canonicalVocabularyKey,
  detectJlptLevel,
  detectLessonNumber,
  normalizeExtractedWord,
} from "./ingestion-utils";

export interface ExtractedWord {
  kanji?: string;
  kana: string;
  romaji?: string;
  burmese_meaning: string;
  jlpt_level: "N5" | "N4";
  part_of_speech?: string;
  lesson?: number | null;
  example_sentence_jp?: string;
  example_sentence_mm?: string;
}

export interface QuizQuestion {
  id: string;
  type: "jp_to_mm" | "mm_to_jp" | "gap_fill";
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  vocabId?: string;
  word?: { kanji?: string; kana: string; burmese_meaning: string; romaji?: string };
}

type Provider = "openai" | "anthropic" | "none";

function detectProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

async function chatJSON(
  system: string,
  user: string,
  schemaHint: string
): Promise<unknown> {
  const provider = detectProvider();
  if (provider === "none") throw new Error("NO_AI_PROVIDER");

  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (provider === "openai") {
      const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
      const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `${system}\n\nReturn ONLY valid JSON matching this shape:\n${schemaHint}` },
            { role: "user", content: user },
          ],
        }),
      });
      if (res.status === 429 && attempt < maxAttempts) {
        await sleep(rateLimitDelayMs(res, attempt));
        continue;
      }
      if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      return JSON.parse(stripFence(text));
    }

    const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: `${system}\n\nReturn ONLY valid JSON matching this shape:\n${schemaHint}`,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (res.status === 429 && attempt < maxAttempts) {
      await sleep(rateLimitDelayMs(res, attempt));
      continue;
    }
    if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    return JSON.parse(stripFence(text));
  }

  throw new Error("AI provider rate-limited after retries");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rateLimitDelayMs(res: Response, attempt: number): number {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000 + 300, 30_000);
    }
  }
  const base = Math.min(2_000 * 2 ** (attempt - 1), 30_000);
  return base + Math.round(Math.random() * 500);
}

function stripFence(text: string): string {
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const firstObject = unfenced.indexOf("{");
  const firstArray = unfenced.indexOf("[");
  const starts = [firstObject, firstArray].filter((index) => index >= 0);
  if (starts.length === 0) return unfenced;
  const start = Math.min(...starts);
  const lastObject = unfenced.lastIndexOf("}");
  const lastArray = unfenced.lastIndexOf("]");
  const end = Math.max(lastObject, lastArray);
  return end > start ? unfenced.slice(start, end + 1) : unfenced;
}

const EXTRACT_SCHEMA = `{
  "items": [
    {
      "kanji": "string (optional, the dictionary headword only)",
      "kana": "string (required, hiragana reading for the headword)",
      "romaji": "string (optional)",
      "burmese_meaning": "string (required, Unicode Burmese translation)",
      "jlpt_level": "N5 or N4",
      "part_of_speech": "string (optional)",
      "lesson": "number or null (Minna no Nihongo lesson 1-25)",
      "example_sentence_jp": "string (optional)",
      "example_sentence_mm": "string (optional, Unicode Burmese)"
    }
  ]
}`;

export function aiProvider(): Provider {
  return detectProvider();
}

export async function aiExtractVocabulary(textChunk: string): Promise<ExtractedWord[]> {
  if (detectProvider() === "none") return [];

  const fallbackLevel = detectJlptLevel(textChunk) ?? "N5";
  const result = await chatJSON(
    "You are a careful Japanese-Burmese dictionary builder. Extract only useful standalone vocabulary headwords from the supplied PDF text. Do not invent words, do not return whole sentences, and do not return a row unless the reading and Burmese meaning are both known. Preserve the source meaning, but normalize obvious PDF line-break artifacts. If a Minna no Nihongo header such as 第1課, 第2課, or Lesson 10 appears, assign that lesson to nearby words until another lesson header appears.",
    `Extract vocabulary from this page-aware PDF chunk. Return one row per dictionary headword and avoid duplicates. Read kana/kanji that may be separated by spaces or line breaks as one word. Every burmese_meaning and example_sentence_mm must contain Unicode Burmese script. Use jlpt_level ${fallbackLevel} only when the source does not identify a level.\n\nTEXT:\n${textChunk.slice(0, 6000)}`,
    EXTRACT_SCHEMA,
  );

  const rawItems = Array.isArray(result)
    ? result
    : result && typeof result === "object" && Array.isArray((result as { items?: unknown }).items)
      ? (result as { items: unknown[] }).items
      : [];
  const unique = new Map<string, ExtractedWord>();

  for (const rawItem of rawItems) {
    const word = normalizeExtractedWord(rawItem, {
      jlptLevel: fallbackLevel,
      lesson: detectLessonNumber(textChunk),
    });
    if (!word) continue;
    const key = canonicalVocabularyKey(word);
    if (!unique.has(key)) unique.set(key, word);
  }

  return [...unique.values()];
}


export async function aiGenerateQuiz(words: { kanji?: string; kana: string; burmese_meaning: string }[], count: number): Promise<QuizQuestion[]> {
  if (detectProvider() === "none") {
    return fallbackGenerateQuiz(words, count);
  }
  const schema = `{
  "questions": [
    {
      "type": "jp_to_mm | mm_to_jp | gap_fill",
      "prompt": "string (the question text in Japanese or Burmese)",
      "options": ["4 strings"],
      "correctIndex": "number 0-3",
      "explanation": "string (Burmese explanation of why the correct answer is right)"
    }
  ]
}`;
  const list = words
    .map((w, i) => `${i + 1}. ${w.kanji ?? w.kana} (${w.burmese_meaning})`)
    .join("\n");
  const result = (await chatJSON(
    "You create JLPT N5/N4 practice quiz questions for a Burmese-speaking Japanese learner. Explanations must be in Burmese (Unicode). Distractors must be plausible but incorrect. Exactly one correct option per question.",
    `Create ${count} multiple-choice questions using ONLY these words as material:\n${list}\nMix of types: Japanese->Burmese meaning, Burmese->Japanese, and gap-fill.\nReturn exactly ${count} questions.`,
    schema
  )) as { questions?: QuizQuestion[] };
  return (result?.questions ?? []).slice(0, count).map((q, i) => ({ ...q, id: `q${i}` }));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fallbackGenerateQuiz(words: { kanji?: string; kana: string; burmese_meaning: string }[], count: number): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const pool = [...words].filter((w) => w.burmese_meaning && w.burmese_meaning !== w.kana);
  for (let i = 0; i < count && pool.length > 0; i++) {
    const target = pool[i % pool.length];
    const distractors = shuffle(pool.filter((w) => w.kana !== target.kana)).slice(0, 3);
    if (distractors.length < 3) continue;
    const type = i % 3;
    if (type === 0) {
      const options = shuffle([...distractors.map((d) => d.burmese_meaning), target.burmese_meaning]);
      questions.push({
        id: `q${i}`,
        type: "jp_to_mm",
        prompt: `"${target.kanji ?? target.kana}" ၏ အနက်အဓိပ္ပာယ်မှာ အဘယ်နည်း။`,
        options,
        correctIndex: options.indexOf(target.burmese_meaning),
        explanation: `"${target.kanji ?? target.kana}" (${target.kana}) သည် "${target.burmese_meaning}" ဖြစ်သည်။`,
        word: target,
      });
    } else if (type === 1) {
      const options = shuffle([...distractors.map((d) => d.kanji ?? d.kana), target.kanji ?? target.kana]);
      questions.push({
        id: `q${i}`,
        type: "mm_to_jp",
        prompt: `"${target.burmese_meaning}" ၏ ဂျပန်စကားလုံးမှာ အဘယ်နည်း။`,
        options,
        correctIndex: options.indexOf(target.kanji ?? target.kana),
        explanation: `"${target.burmese_meaning}" ၏ ဂျပန်အဓိပ္ပာယ်မှာ "${target.kanji ?? target.kana}" (${target.kana}) ဖြစ်သည်။`,
        word: target,
      });
    } else {
      const fill = target.kanji ?? target.kana;
      const prompt = `... ________ ...  (${target.kana})`;
      const options = shuffle([...distractors.map((d) => d.kanji ?? d.kana), fill]);
      questions.push({
        id: `q${i}`,
        type: "gap_fill",
        prompt: `ဂျပန်စာကြောင်း၏ နေရာလွတ်တွင် မှန်ကန်သော စကားလုံးကို ရွေးပါ။ ${prompt}`,
        options,
        correctIndex: options.indexOf(fill),
        explanation: `မှန်ကန်သော အဖြေမှာ "${fill}" (${target.kana}) ဖြစ်ပြီး "${target.burmese_meaning}" ဟု အဓိပ္ပာယ်ရသည်။`,
        word: target,
      });
    }
  }
  return questions;
}
