"use client";

import { useState, useCallback, useEffect } from "react";
import { FileText, FolderOpen, Loader2, Play, CheckCircle2, AlertTriangle } from "lucide-react";

interface IngestResult {
  scanned: string[];
  inserted: number;
  progressEnsured: number;
  failed: string[];
}

export function IngestPanel({
  folder,
  initialPdfs,
}: {
  folder: string;
  initialPdfs: string[];
}) {
  const [pdfs, setPdfs] = useState(initialPdfs);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Ingestion failed.");
        setRunning(false);
        return;
      }
      setResult(data);
      const r = await fetch("/api/pdf-list").then((x) => x.json());
      if (r?.pdfs) setPdfs(r.pdfs);
    } catch {
      setError("Network error while running ingestion.");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/pdf-list")
      .then((r) => r.json())
      .then((d) => {
        if (d?.pdfs) setPdfs(d.pdfs);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-4">
        <div className="paper-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen size={18} className="text-crimson" />
            <span className="text-sm font-medium text-indigo-dark">Scan folder</span>
          </div>
          <code className="block text-xs bg-paper-deep/60 rounded-lg px-3 py-2 text-paper-ink/70 break-all">
            {folder}
          </code>
          <p className="text-xs text-paper-ink/50 mt-2">
            Drop any Japanese or Burmese PDF into this Desktop folder, then run ingestion
            to parse and store new vocabulary.
          </p>
          <button
            onClick={run}
            disabled={running}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson text-paper font-semibold hover:bg-crimson-soft disabled:opacity-60 transition-colors shadow-md shadow-crimson/20"
          >
            {running ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Parsing & structuring…
              </>
            ) : (
              <>
                <Play size={17} /> Run ingestion
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 flex items-start gap-2 text-sm text-crimson bg-crimson/5 border border-crimson/20 rounded-lg p-3">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
              <div className="flex items-center gap-2 font-semibold mb-2">
                <CheckCircle2 size={16} /> Ingestion complete
              </div>
              <ul className="space-y-1 text-emerald-700">
                <li>Scanned {result.scanned.length} PDF file(s)</li>
                <li>Inserted {result.inserted} new word(s)</li>
                <li>Progress records ensured for {result.progressEnsured} word(s)</li>
                {result.failed.length > 0 && (
                  <li className="text-crimson">
                    Failed: {result.failed.join(", ")}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="paper-card rounded-2xl p-5 h-fit sticky top-6">
        <h3 className="font-semibold text-indigo-dark mb-3 flex items-center gap-2">
          <FileText size={16} className="text-crimson" />
          PDFs found
        </h3>
        {pdfs.length === 0 ? (
          <p className="text-xs text-paper-ink/50">
            No PDFs yet. Add them to the folder above.
          </p>
        ) : (
          <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {pdfs.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-xs bg-paper-deep/40 rounded-lg px-3 py-2 text-paper-ink/80"
              >
                <FileText size={13} className="text-crimson/60 shrink-0" />
                <span className="truncate">{f}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
