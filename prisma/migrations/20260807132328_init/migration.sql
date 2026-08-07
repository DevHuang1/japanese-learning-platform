-- CreateTable
CREATE TABLE "vocabulary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kanji" TEXT,
    "kana" TEXT NOT NULL,
    "romaji" TEXT,
    "burmese_meaning" TEXT NOT NULL,
    "jlpt_level" TEXT NOT NULL,
    "part_of_speech" TEXT,
    "example_sentence_jp" TEXT,
    "example_sentence_mm" TEXT,
    "pdf_source" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_word_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vocab_id" TEXT NOT NULL,
    "ease_factor" REAL NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "next_review_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'learning',
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_word_progress_vocab_id_fkey" FOREIGN KEY ("vocab_id") REFERENCES "vocabulary" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "study_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "study_date" DATETIME NOT NULL,
    "words_reviewed" INTEGER NOT NULL DEFAULT 0,
    "quizzes_completed" INTEGER NOT NULL DEFAULT 0,
    "accuracy_score" REAL NOT NULL DEFAULT 0.0,
    "time_spent_minutes" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "vocabulary_jlpt_level_idx" ON "vocabulary"("jlpt_level");

-- CreateIndex
CREATE UNIQUE INDEX "user_word_progress_vocab_id_key" ON "user_word_progress"("vocab_id");
