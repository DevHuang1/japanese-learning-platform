# Ingestion Quality Dashboard and OCR Correction Workspace

## 1. Purpose

Wagaku needs an operational surface for understanding PDF ingestion quality and a safe correction workflow for scanned-image PDFs. The dashboard will expose ingestion provenance, extraction quality, duplicate/fuzzy-match outcomes, OCR confidence, processing time, and accuracy trends. The OCR workspace will let an operator inspect the source page beside OCR text, correct uncertain text, rerun vocabulary parsing, and approve or reject resulting vocabulary candidates without bypassing canonical-key or review safeguards.

OCR and AI output remain untrusted. Every correction preserves the original output, the edited output, page provenance, actor, and timestamps. Corrections feed the same normalization, validation, duplicate-prevention, and fuzzy-review pipeline used by ordinary ingestion.

## 2. Core workflow

```text
Upload PDF
  -> create ingestion batch
  -> extract pages and detect selectable/image-only pages
  -> run OCR fallback where required
  -> persist page-level provenance and metrics
  -> parse/validate vocabulary candidates
  -> exact canonical-key match or conservative fuzzy-review queue
  -> dashboard reports metrics
  -> OCR workspace presents low-confidence pages/candidates
  -> operator edits text or candidate fields
  -> reprocess corrected page
  -> preview exact/fuzzy/new decisions
  -> approve import or send candidate to review
  -> finalize batch and update quality metrics
```

The workspace must never mutate canonical vocabulary directly from a free-form OCR edit. A correction creates a revision, reparses the page, and requires an explicit import-preview confirmation. Exact matches may enrich safely; fuzzy matches remain reviewable; homographs remain separate.

## 3. Data model additions

The existing `Vocabulary` and `VocabularyMatchReview` models remain the source of truth for learned vocabulary and fuzzy decisions. Add the following Prisma models:

| Model | Purpose | Key fields |
|---|---|---|
| `IngestionBatch` | One PDF processing run | `id`, `sourceName`, `sourceHash`, `status`, `startedAt`, `completedAt`, counters, aggregate timings |
| `IngestionPage` | Page-level extraction/OCR provenance | `batchId`, `pageNumber`, `mode`, `status`, `sourceImagePath`, `rawText`, `normalizedText`, `ocrLanguages`, confidence, timings, error |
| `IngestionCandidate` | Validated vocabulary candidate before final import | `pageId`, incoming JSON, normalized fields, canonical key, decision kind, matched vocabulary/review IDs, status |
| `OcrCorrection` | Immutable correction audit record | `pageId`, `candidateId`, original text, corrected text, field changes, reason, actor, createdAt |
| `IngestionMetric` | Optional time-series metric for dashboard aggregation | `batchId`, metric name, numeric value, unit, dimensions JSON |

Recommended statuses are `queued`, `processing`, `needs_review`, `approved`, `completed`, `failed`, and `cancelled`. Add indexes on batch status/date, page batch/status, candidate decision/status, and source hash. Add a uniqueness constraint on `(batchId, pageNumber)` and a correction revision sequence per page.

## 4. Dashboard architecture

The dashboard page is a server-rendered shell with client-side filters and charts. It should be available at `/ingestion` and use a responsive two-column layout.

| Component | Responsibility |
|---|---|
| `IngestionDashboardPage` | Server shell, metadata, initial summary query |
| `IngestionSummaryCards` | Batch count, success rate, OCR page rate, duplicate/review rate, median duration |
| `IngestionTrendChart` | Accuracy, OCR confidence, duration, and duplicate rate over time |
| `IngestionBatchTable` | Sortable/filterable batch history with status and quality badges |
| `IngestionBatchDrawer` | Batch-level page/candidate breakdown and failure details |
| `OcrAttentionQueue` | Pages/candidates needing correction, ordered by confidence and impact |
| `OcrCorrectionWorkspace` | Side-by-side source preview, OCR text editor, candidate preview, action controls |
| `OcrPageNavigator` | Page thumbnails/status and correction progress |
| `CandidateDecisionPreview` | Exact/enrich/review/new result with evidence and collision risk |

The first implementation can use lightweight CSS bars and tables rather than adding a chart dependency. All metric values must include a time range and sample count so small samples are not misread as stable accuracy.

## 5. API endpoints

### Dashboard APIs

| Method and route | Purpose |
|---|---|
| `GET /api/ingestion/summary?from=&to=` | Summary cards and aggregate rates |
| `GET /api/ingestion/trends?metric=&from=&to=&bucket=` | Time-bucketed quality/performance series |
| `GET /api/ingestion/batches?status=&source=&cursor=` | Paginated batch history |
| `GET /api/ingestion/batches/:id` | Batch detail, page metrics, candidate counts, errors |
| `GET /api/ingestion/batches/:id/pages` | Paginated page-level provenance and OCR queue |

### OCR correction APIs

| Method and route | Purpose |
|---|---|
| `GET /api/ingestion/pages/:id` | Page image/text/provenance/candidates |
| `POST /api/ingestion/pages/:id/corrections` | Save an immutable correction revision |
| `POST /api/ingestion/pages/:id/reprocess` | Re-run normalization, OCR parsing, and matching from the corrected text |
| `GET /api/ingestion/pages/:id/preview` | Return candidate decisions without mutating vocabulary |
| `POST /api/ingestion/pages/:id/approve` | Atomically approve previewed decisions and enqueue fuzzy reviews |
| `POST /api/ingestion/pages/:id/reject` | Reject a page/candidate with reason |
| `GET /api/ingestion/corrections?batchId=&pageId=` | Audit history for corrections |

Each mutating endpoint validates the request body, checks the current page/batch status, and uses a transaction where vocabulary or review rows are changed. `reprocess` is idempotent for the same correction revision. `approve` rechecks canonical uniqueness inside the transaction and never trusts a stale preview.

## 6. Example API contracts

`GET /api/ingestion/summary` returns:

```json
{
  "range": { "from": "2026-08-01", "to": "2026-08-31" },
  "batches": { "total": 18, "completed": 16, "failed": 1, "needsReview": 1 },
  "quality": {
    "selectableAccuracy": 0.98,
    "ocrAccuracy": 0.91,
    "ocrPageRate": 0.34,
    "duplicateRate": 0.07,
    "fuzzyReviewRate": 0.04
  },
  "performance": { "medianDurationMs": 18400, "p95DurationMs": 46200 },
  "attention": { "pages": 6, "candidates": 14 }
}
```

`POST /api/ingestion/pages/:id/corrections` accepts:

```json
{
  "baseRevision": 0,
  "correctedText": "検証 けんしょう စစ်ဆေးအတည်ပြုသည်",
  "fieldEdits": { "reading": "けんしょう" },
  "reason": "OCR confused ょゐ with ょう"
}
```

The response returns the new revision and page status, not a vocabulary mutation:

```json
{
  "correctionId": "corr_123",
  "revision": 1,
  "status": "corrected",
  "nextAction": "reprocess"
}
```

`GET /api/ingestion/pages/:id/preview` returns structured decisions using the existing match decision union: `exact`, `enrich`, `review`, or `new`, together with normalized values, canonical key, candidate evidence, and collision risk.

## 7. Security and correctness rules

The source PDF path and OCR working files are server-side values; clients receive only signed/authorized preview URLs or sanitized page images. OCR commands use argument arrays, timeouts, temporary directories, and cleanup in `finally`. Raw OCR text is retained for provenance but must not be rendered as executable HTML.

All edits are optimistic-concurrency protected by `baseRevision`. A stale correction returns `409 Conflict` with the current revision. Approval is transactional and re-runs canonical-key uniqueness checks. The dashboard is read-only with respect to vocabulary except through the explicit approval workflow.

## 8. Observability and validation

Every batch and page records extraction mode, OCR language, OCR confidence, parse duration, match duration, candidate counts, review count, duplicate count, and error category. The dashboard aggregates only completed measurements and exposes sample counts. Tests must cover API validation, correction revision conflicts, idempotent reprocessing, canonical-key collisions, fuzzy-review creation, and approval transactions. Playwright coverage should verify dashboard rendering, OCR correction, preview decisions, and accessible status feedback.
