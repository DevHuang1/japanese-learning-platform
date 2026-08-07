import { toHiragana } from "./japanese";

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
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

const EXTRACT_SCHEMA = `{
  "items": [
    {
      "kanji": "string (optional)",
      "kana": "string (required, hiragana reading)",
      "romaji": "string (optional)",
      "burmese_meaning": "string (required, Unicode Burmese, U+1000-U+109F)",
      "jlpt_level": "N5 or N4",
      "part_of_speech": "string (optional)",
      "lesson": "number (optional, Minna no Nihongo lesson 1-25. Detect from the chapter header such as 第1課 / 第2課 / Lesson N in the text. Use null if unknown)",
      "example_sentence_jp": "string (optional)",
      "example_sentence_mm": "string (optional)"
    }
  ]
}`;

export function aiProvider(): Provider {
  return detectProvider();
}

export async function aiExtractVocabulary(textChunk: string): Promise<ExtractedWord[]> {
  if (detectProvider() === "none") {
    return [];
  }
  const result = (await chatJSON(
    "You are a Japanese-Burmese dictionary builder. Extract vocabulary words and grammar points from the given Japanese text. If the text contains a Minna no Nihongo chapter header like 第1課, 第2課, or Lesson N, assign that lesson number to every word in the chunk.",
    `Extract all Japanese vocabulary from this text. Provide accurate Unicode Burmese (U+1000-U+109F) translations. If you cannot translate a word to Burmese confidently, still give your best translation.\n\nTEXT:\n${textChunk.slice(0, 6000)}`,
    EXTRACT_SCHEMA
  )) as { items?: ExtractedWord[] };
  const items = (result?.items ?? []).filter(
    (i) => i.kana && i.burmese_meaning
  );
  return items.map((i) => ({
    ...i,
    kana: toHiragana(i.kana),
    jlpt_level: i.jlpt_level === "N4" ? "N4" : "N5",
    lesson: typeof i.lesson === "number" && i.lesson >= 1 && i.lesson <= 25 ? i.lesson : null,
  }));
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
