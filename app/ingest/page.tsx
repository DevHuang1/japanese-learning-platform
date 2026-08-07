import type { Metadata } from "next";
import { FileSearch } from "lucide-react";
import { IngestPanel } from "@/components/IngestPanel";
import { listPdfs, pdfFolder } from "@/lib/pdf-parser";

export const metadata: Metadata = { title: "PDF Ingest" };
export const dynamic = "force-dynamic";

export default async function IngestPage() {
  const folder = pdfFolder();
  const pdfs = (await listPdfs(folder)).map((p) => p.split("/").pop() ?? p);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-crimson/10 text-crimson flex items-center justify-center">
            <FileSearch size={20} />
          </span>
          <div>
            <h1 className="font-jp text-2xl text-indigo-dark">取り込み</h1>
            <p className="text-sm text-paper-ink/60">
              Scan your JLPT PDFs · extract text · structure with AI
            </p>
          </div>
        </div>
      </header>
      <IngestPanel folder={folder} initialPdfs={pdfs} />
    </div>
  );
}
