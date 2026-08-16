-- CreateTable
CREATE TABLE "ingestion_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_name" TEXT NOT NULL,
    "source_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "selectable_pages" INTEGER NOT NULL DEFAULT 0,
    "ocr_pages" INTEGER NOT NULL DEFAULT 0,
    "total_pages" INTEGER NOT NULL DEFAULT 0,
    "extracted_candidates" INTEGER NOT NULL DEFAULT 0,
    "imported_candidates" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "failed_pages" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ingestion_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'selectable',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "source_image_path" TEXT,
    "raw_text" TEXT,
    "normalized_text" TEXT,
    "ocr_languages" TEXT,
    "ocr_confidence" REAL,
    "extraction_ms" INTEGER,
    "ocr_ms" INTEGER,
    "parse_ms" INTEGER,
    "error_category" TEXT,
    "error_message" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ingestion_pages_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ingestion_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ingestion_candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "incoming_json" TEXT NOT NULL,
    "canonical_key" TEXT,
    "decision_kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "score" REAL,
    "reasons_json" TEXT,
    "vocabulary_id" TEXT,
    "review_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ingestion_candidates_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ingestion_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ingestion_candidates_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "ingestion_pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ingestion_candidates_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabulary" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ocr_corrections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "page_id" TEXT NOT NULL,
    "candidate_id" TEXT,
    "base_revision" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "original_text" TEXT NOT NULL,
    "corrected_text" TEXT NOT NULL,
    "field_edits_json" TEXT,
    "reason" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'local-user',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ocr_corrections_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "ingestion_pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ocr_corrections_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "ingestion_candidates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ingestion_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT,
    "dimensions_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ingestion_metrics_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ingestion_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ingestion_batches_status_idx" ON "ingestion_batches"("status");

-- CreateIndex
CREATE INDEX "ingestion_batches_created_at_idx" ON "ingestion_batches"("created_at");

-- CreateIndex
CREATE INDEX "ingestion_batches_source_hash_idx" ON "ingestion_batches"("source_hash");

-- CreateIndex
CREATE INDEX "ingestion_pages_batch_id_status_idx" ON "ingestion_pages"("batch_id", "status");

-- CreateIndex
CREATE INDEX "ingestion_pages_status_ocr_confidence_idx" ON "ingestion_pages"("status", "ocr_confidence");

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_pages_batch_id_page_number_key" ON "ingestion_pages"("batch_id", "page_number");

-- CreateIndex
CREATE INDEX "ingestion_candidates_batch_id_status_idx" ON "ingestion_candidates"("batch_id", "status");

-- CreateIndex
CREATE INDEX "ingestion_candidates_page_id_idx" ON "ingestion_candidates"("page_id");

-- CreateIndex
CREATE INDEX "ingestion_candidates_decision_kind_idx" ON "ingestion_candidates"("decision_kind");

-- CreateIndex
CREATE INDEX "ocr_corrections_page_id_created_at_idx" ON "ocr_corrections"("page_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_corrections_page_id_revision_key" ON "ocr_corrections"("page_id", "revision");

-- CreateIndex
CREATE INDEX "ingestion_metrics_batch_id_name_idx" ON "ingestion_metrics"("batch_id", "name");

-- CreateIndex
CREATE INDEX "ingestion_metrics_name_created_at_idx" ON "ingestion_metrics"("name", "created_at");
