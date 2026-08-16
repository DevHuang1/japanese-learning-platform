"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileScan, Gauge, History, RefreshCw, Save, ShieldAlert, Sparkles, XCircle, type LucideIcon } from "lucide-react";

type Summary = {
  batches: { total: number; completed: number; failed: number; needsReview: number };
  quality: { selectableAccuracy: number; ocrAccuracy: number; ocrPageRate: number; duplicateRate: number; fuzzyReviewRate: number };
  performance: { medianDurationMs: number; p95DurationMs: number };
  attention: { pages: number; candidates: number };
};

type Batch = {
  id: string; sourceName: string; status: string; totalPages: number; ocrPages: number;
  extractedCandidates: number; duplicateCount: number; reviewCount: number; durationMs: number | null; createdAt: string;
};

type Page = {
  id: string; pageNumber: number; mode: string; status: string; rawText: string | null;
  normalizedText: string | null; ocrLanguages: string | null; ocrConfidence: number | null; revision: number;
  candidates: Array<{ id: string; decisionKind: string; status: string; score: number | null; incoming: Record<string, unknown>; reasons: string[] }>;
};

function percent(value: number) { return `${Math.round(value * 100)}%`; }
function statusClass(status: string) {
  if (status === "completed" || status === "approved") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "failed" || status === "rejected") return "bg-red-50 text-red-800 border-red-200";
  if (status === "needs_review" || status === "corrected") return "bg-amber-50 text-amber-900 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export function IngestionDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [correctedText, setCorrectedText] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [summaryResponse, batchesResponse] = await Promise.all([
      fetch("/api/ingestion/summary"),
      fetch("/api/ingestion/batches?limit=20"),
    ]);
    if (summaryResponse.ok) setSummary(await summaryResponse.json());
    if (batchesResponse.ok) setBatches((await batchesResponse.json()).batches);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([fetch("/api/ingestion/summary"), fetch("/api/ingestion/batches?limit=20")]).then(async ([summaryResponse, batchesResponse]) => {
      if (!active) return;
      if (summaryResponse.ok) setSummary(await summaryResponse.json());
      if (batchesResponse.ok) setBatches((await batchesResponse.json()).batches);
    });
    return () => { active = false; };
  }, []);

  async function inspectBatch(batchId: string) {
    const response = await fetch(`/api/ingestion/batches/${batchId}/pages?attention=true`);
    if (!response.ok) return;
    const data = await response.json();
    setPages(data.pages);
    setSelectedPage(data.pages[0] ?? null);
    setCorrectedText(data.pages[0]?.rawText ?? "");
  }

  function choosePage(page: Page) {
    setSelectedPage(page);
    setCorrectedText(page.rawText ?? "");
    setMessage("");
  }

  async function action(path: string, body?: Record<string, unknown>) {
    if (!selectedPage) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/ingestion/pages/${selectedPage.id}/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}),
    });
    const data = await response.json();
    setMessage(response.ok ? `Page ${data.status ?? "updated"}.` : data.error ?? "Request failed.");
    setBusy(false);
    if (response.ok) {
      const refreshed = await fetch(`/api/ingestion/pages/${selectedPage.id}`);
      if (refreshed.ok) {
        const page = (await refreshed.json()).page as Page;
        setSelectedPage(page); setCorrectedText(page.rawText ?? "");
      }
      await load();
    }
  }

  const selectedCandidates = useMemo(() => selectedPage?.candidates ?? [], [selectedPage]);

  const metricCards: Array<[string, string | number, LucideIcon]> = [
    ["Batches", summary?.batches.total ?? 0, History],
    ["Completed", summary?.batches.completed ?? 0, CheckCircle2],
    ["OCR page rate", summary ? percent(summary.quality.ocrPageRate) : "—", FileScan],
    ["Fuzzy review rate", summary ? percent(summary.quality.fuzzyReviewRate) : "—", ShieldAlert],
    ["Median duration", summary ? `${summary.performance.medianDurationMs} ms` : "—", Gauge],
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Ingestion quality summary">
        {metricCards.map(([label, value, Icon]) => (
          <div className="paper-card rounded-2xl p-5" key={String(label)}>
            <div className="flex items-center justify-between text-paper-ink/60"><span className="text-xs font-semibold uppercase tracking-widest">{label}</span><Icon size={18} /></div>
            <p className="mt-3 text-2xl font-semibold text-indigo-dark">{value as string | number}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_1.4fr]">
        <div className="paper-card rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-indigo-dark">Ingestion history</h2><p className="text-sm text-paper-ink/60">Select a batch to inspect OCR attention pages.</p></div><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => void load()} aria-label="Refresh ingestion history"><RefreshCw size={16} /></button></div>
          <div className="space-y-2">
            {batches.length === 0 && <p className="rounded-xl bg-paper-deep/40 p-4 text-sm">No ingestion batches recorded yet.</p>}
            {batches.map((batch) => <button key={batch.id} onClick={() => void inspectBatch(batch.id)} className="w-full rounded-xl border p-4 text-left transition hover:border-crimson/50 hover:bg-crimson/5">
              <div className="flex items-center justify-between gap-3"><span className="font-medium text-indigo-dark">{batch.sourceName}</span><span className={`rounded-full border px-2 py-1 text-xs ${statusClass(batch.status)}`}>{batch.status}</span></div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-paper-ink/65"><span>{batch.totalPages} pages</span><span>{batch.ocrPages} OCR</span><span>{batch.reviewCount} reviews</span></div>
            </button>)}
          </div>
        </div>

        <div className="paper-card rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-indigo-dark">OCR attention queue</h2><p className="text-sm text-paper-ink/60">Correct uncertain text before it reaches vocabulary.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900">{summary?.attention.pages ?? 0} pages</span></div>
          {pages.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-paper-ink/60">Select an ingestion batch to open its correction queue.</div> : <div className="space-y-2">{pages.map((page) => <button key={page.id} onClick={() => choosePage(page)} className={`w-full rounded-xl border p-3 text-left ${selectedPage?.id === page.id ? "border-crimson bg-crimson/5" : "hover:bg-paper-deep/30"}`}><div className="flex items-center justify-between"><span className="font-medium">Page {page.pageNumber}</span><span className={`rounded-full border px-2 py-1 text-xs ${statusClass(page.status)}`}>{page.status}</span></div><p className="mt-1 text-xs text-paper-ink/60">{page.mode} · {page.ocrConfidence !== null ? `${Math.round(page.ocrConfidence * 100)}% OCR confidence` : "confidence unavailable"} · {page.candidates.length} candidates</p></button>)}</div>}
        </div>
      </section>

      {selectedPage && <section className="paper-card rounded-2xl p-5" aria-label="OCR correction workspace">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Sparkles size={18} className="text-crimson" /><h2 className="text-lg font-semibold text-indigo-dark">OCR correction workspace · page {selectedPage.pageNumber}</h2></div><p className="mt-1 text-sm text-paper-ink/60">Revision {selectedPage.revision}. Original OCR remains in the correction history.</p></div><span className={`rounded-full border px-3 py-1 text-sm ${statusClass(selectedPage.status)}`}>{selectedPage.status}</span></div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div><label className="mb-2 block text-sm font-semibold text-indigo-dark" htmlFor="ocr-source">OCR text</label><textarea id="ocr-source" value={correctedText} onChange={(event) => setCorrectedText(event.target.value)} className="min-h-64 w-full rounded-xl border bg-white p-4 font-jp text-lg leading-8 outline-none focus:border-crimson" /><label className="mt-4 mb-2 block text-sm font-semibold text-indigo-dark" htmlFor="ocr-reason">Correction reason</label><input id="ocr-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. OCR confused ょゐ with ょう" className="w-full rounded-xl border bg-white p-3 outline-none focus:border-crimson" /><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void action("corrections", { baseRevision: selectedPage.revision, correctedText, reason })} className="inline-flex items-center gap-2 rounded-xl bg-indigo-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} /> Save correction</button><button disabled={busy} onClick={() => void action("reprocess")} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"><RefreshCw size={16} /> Reprocess</button><button disabled={busy} onClick={() => void action("approve")} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800"><CheckCircle2 size={16} /> Approve</button><button disabled={busy} onClick={() => void action("reject", { reason })} className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-800"><XCircle size={16} /> Reject</button></div>{message && <p className="mt-3 rounded-lg bg-paper-deep/50 p-3 text-sm" role="status">{message}</p>}</div>
          <div><h3 className="mb-2 text-sm font-semibold text-indigo-dark">Candidate preview</h3><div className="space-y-3">{selectedCandidates.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-paper-ink/60">Reprocess this page to generate candidate decisions.</p>}{selectedCandidates.map((candidate) => <article key={candidate.id} className="rounded-xl border bg-white p-4"><div className="flex items-center justify-between"><span className="font-jp text-xl">{String(candidate.incoming.kanji ?? candidate.incoming.kana ?? "Candidate")}</span><span className={`rounded-full border px-2 py-1 text-xs ${statusClass(candidate.status)}`}>{candidate.decisionKind}</span></div><p className="mt-1 text-sm text-paper-ink/70">{String(candidate.incoming.kana ?? "")} · {String(candidate.incoming.burmese_meaning ?? "")}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-paper-ink/60">{candidate.reasons.map((item) => <span className="rounded-full bg-paper-deep px-2 py-1" key={item}>{item}</span>)}</div></article>)}</div></div>
        </div>
      </section>}
    </div>
  );
}
