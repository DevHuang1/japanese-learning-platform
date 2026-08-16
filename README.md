# 和学 Wagaku — Personal Japanese Learning Platform

Local-first JLPT N5/N4 study app for Burmese-speaking learners. Scans your
Japanese PDFs, structures vocabulary with AI, and serves flashcards (SM-2),
an interactive reader with hoverable Burmese glosses, procedural AI quizzes,
and a wabi-sabi-themed dashboard.

## Quick start

```bash
npm install
npm run db:migrate   # create SQLite database (prisma/dev.db)
npm run db:seed      # load 20 test N5/N4 words
npm run dev          # → http://localhost:3000
```

## Add your PDFs

Drop any Japanese or Burmese `.pdf` into **`~/Desktop/JLPT-PDFs`**
(the app scans this folder). Then set an AI provider in `.env`:

```env
# Any OpenAI-compatible API works (Groq, OpenAI, OpenRouter, DeepSeek, Ollama, LM Studio…)
OPENAI_API_KEY="<your key>"
OPENAI_BASE_URL="https://api.groq.com/openai/v1"
OPENAI_MODEL="llama-3.3-70b-versatile"
```

Run ingestion from the UI (**PDF Ingest** page) or the CLI:

```bash
npm run ingest
```

PDFs are extracted page by page with `pdf-parse`, cleaned for common line-break and
invisible-character artifacts, and split at line/sentence boundaries while retaining
page and lesson context. The AI returns structured JSON (kanji / kana / romaji /
Unicode Burmese meaning / JLPT level / example sentences), which is runtime-validated,
normalized to hiragana, deduplicated with a database-enforced canonical identity, and
stored in SQLite. Likely OCR duplicates are not merged automatically; they are queued
for review at **`/reviews`**. Image-only PDFs are reported as non-extractable and
require OCR before ingestion.

Optional ingestion limits can be tuned in `.env`:
```env
PDF_MAX_BYTES=26214400  # 25 MiB default
PDF_MAX_PAGES=250
PDF_CHUNK_CHARS=4200
```

> Without an API key the app still works fully offline using the seeded data
> (quizzes are procedurally generated). Ingestion simply waits for a key.

## Features

| Page        | What it does                                                        |
|-------------|---------------------------------------------------------------------|
| Dashboard   | Progress rings (N5/N4/mastery), day streak, daily target sliders     |
| Flashcards  | SM-2 spaced repetition, flip animation, Japanese audio (Web Speech)  |
| Reader      | kuromoji tokenizer + hover/tap Burmese glosses, add-to-deck          |
| AI Quiz     | Procedural questions with instant Burmese explanations               |
| Vocabulary  | Searchable library with learning status per word                     |
| Reviews     | Accept or reject conservative fuzzy-match candidates                 |
| PDF Ingest  | Scan `~/Desktop/JLPT-PDFs`, structure and insert new words           |

## Scripts

- `npm run db:generate` — regenerate Prisma client
- `npm run db:migrate` — apply schema migrations
- `npm run db:seed` — reset + seed 20 demo words
- `npm run db:backfill-vocabulary-keys` — detect collisions and populate canonical identities for legacy rows
- `npm run ingest` — scan PDF folder and insert AI-parsed vocabulary
- `npm test` — run ingestion and vocabulary-matching regression tests
- `npm run lint` / `npm run build` — checks and production build

After upgrading an existing database, apply migrations and backfill identities before
running a real import:
```bash
npm run db:migrate
npm run db:backfill-vocabulary-keys
```
The backfill command stops without changing rows if it finds canonical-key collisions;
resolve those rows manually before retrying.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Prisma + SQLite ·
`pdf-parse` · `kuromoji` · Framer Motion · Lucide · `next/font/google`
(Noto Serif JP, Sawarabi Mincho, Padauk, Inter).
