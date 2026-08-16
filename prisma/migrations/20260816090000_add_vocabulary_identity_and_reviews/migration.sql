-- Add a nullable canonical identity first so existing rows can be backfilled safely.
ALTER TABLE "vocabulary" ADD COLUMN "canonical_key" TEXT;

-- SQLite unique indexes allow multiple NULL values while legacy rows are pending backfill.
CREATE UNIQUE INDEX "vocabulary_canonical_key_key" ON "vocabulary"("canonical_key");

-- Persist fuzzy candidates for human review instead of silently merging them.
CREATE TABLE "vocabulary_match_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "review_key" TEXT NOT NULL,
    "incoming_json" TEXT NOT NULL,
    "candidate_id" TEXT,
    "score" REAL NOT NULL,
    "reasons_json" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vocabulary_match_reviews_candidate_id_fkey"
      FOREIGN KEY ("candidate_id") REFERENCES "vocabulary" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "vocabulary_match_reviews_review_key_key"
  ON "vocabulary_match_reviews"("review_key");
CREATE INDEX "vocabulary_match_reviews_status_idx"
  ON "vocabulary_match_reviews"("status");
CREATE INDEX "vocabulary_match_reviews_candidate_id_idx"
  ON "vocabulary_match_reviews"("candidate_id");

CREATE INDEX "vocabulary_kana_idx" ON "vocabulary"("kana");
CREATE INDEX "vocabulary_kanji_idx" ON "vocabulary"("kanji");
