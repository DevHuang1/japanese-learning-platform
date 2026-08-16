import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { VocabularyReviewPanel } from "@/components/VocabularyReviewPanel";

export const metadata: Metadata = { title: "Vocabulary Reviews" };
export const dynamic = "force-dynamic";

export default function ReviewsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-crimson/10 text-crimson">
            <ClipboardCheck size={20} />
          </span>
          <div>
            <h1 className="font-jp text-2xl text-indigo-dark">Vocabulary Reviews</h1>
            <p className="text-sm text-paper-ink/60">
              Confirm likely OCR duplicates without merging real homographs.
            </p>
          </div>
        </div>
      </header>
      <VocabularyReviewPanel />
    </div>
  );
}
