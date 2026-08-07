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
# OpenAI-compatible (OpenAI, OpenRouter, DeepSeek, Ollama, LM Studio…)
OPENAI_API_KEY="sk-..."
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4o-mini"

# or Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-..."
```

Run ingestion from the UI (**PDF Ingest** page) or the CLI:

```bash
npm run ingest
```

PDFs are extracted with `pdf-parse`, split into chunks, and the AI returns
structured JSON (kanji / kana / romaji / Unicode Burmese meaning / JLPT level /
example sentences) which is deduped and stored in SQLite.

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
| PDF Ingest  | Scan `~/Desktop/JLPT-PDFs`, structure and insert new words           |

## Scripts

- `npm run db:generate` — regenerate Prisma client
- `npm run db:migrate` — apply schema migrations
- `npm run db:seed` — reset + seed 20 demo words
- `npm run ingest` — scan PDF folder and insert AI-parsed vocabulary
- `npm run lint` / `npm run build` — checks and production build

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Prisma + SQLite ·
`pdf-parse` · `kuromoji` · Framer Motion · Lucide · `next/font/google`
(Noto Serif JP, Sawarabi Mincho, Padauk, Inter).
