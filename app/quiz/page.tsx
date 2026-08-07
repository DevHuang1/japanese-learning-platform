import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";
import { QuizRunner } from "@/components/QuizRunner";

export const metadata: Metadata = { title: "AI Quiz" };

export default function QuizPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-crimson/10 text-crimson flex items-center justify-center">
            <BrainCircuit size={20} />
          </span>
          <div>
            <h1 className="font-jp text-2xl text-indigo-dark">クイズ</h1>
            <p className="text-sm text-paper-ink/60">
              Procedural AI quizzes · generated from your vocabulary
            </p>
          </div>
        </div>
      </header>
      <QuizRunner />
    </div>
  );
}
