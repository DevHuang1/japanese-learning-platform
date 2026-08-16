import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { IngestionDashboard } from "@/components/ingestion/IngestionDashboard";

export const metadata: Metadata = { title: "Ingestion Quality" };
export const dynamic = "force-dynamic";

export default function IngestionPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-crimson/10 text-crimson"><Activity size={20} /></span>
          <div>
            <h1 className="font-jp text-2xl text-indigo-dark">Ingestion Quality</h1>
            <p className="text-sm text-paper-ink/60">PDF provenance, OCR confidence, duplicate risk, and correction workflow.</p>
          </div>
        </div>
      </header>
      <IngestionDashboard />
    </div>
  );
}
