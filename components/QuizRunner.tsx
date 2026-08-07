"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, BrainCircuit, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { GlossText } from "@/components/GlossText";

export interface QuizQuestion {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function QuizRunner() {
  const [level, setLevel] = useState("all");
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const runFetch = useCallback(async () => {
    const res = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, level }),
    });
    return { ok: res.ok, data: await res.json() };
  }, [count, level]);

  useEffect(() => {
    let cancelled = false;
    runFetch()
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(r.data?.error ?? "Failed to generate quiz.");
          setLoading(false);
          return;
        }
        setQuestions(r.data.questions ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Network error. Is the server running?");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [runFetch]);

  const startQuiz = useCallback(() => {
    setLoading(true);
    setError(null);
    setDone(false);
    setSelected(null);
    setScore(0);
    setCurrent(0);
    runFetch()
      .then((r) => {
        if (!r.ok) {
          setError(r.data?.error ?? "Failed to generate quiz.");
          setLoading(false);
          return;
        }
        setQuestions(r.data.questions ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Network error. Is the server running?");
        setLoading(false);
      });
  }, [runFetch]);

  const finish = useCallback(async (finalScore: number) => {
    try {
      await fetch("/api/quiz/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: finalScore, total: questions.length }),
      });
    } catch {
      // non-fatal
    }
  }, [questions.length]);

  const choose = useCallback(
    (i: number) => {
      if (selected !== null) return;
      setSelected(i);
      if (i === questions[current]?.correctIndex) {
        setScore((s) => s + 1);
      }
    },
    [selected, questions, current]
  );

  const next = useCallback(() => {
    if (current + 1 >= questions.length) {
      setDone(true);
      finish(score);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
    }
  }, [current, questions.length, score, finish]);

  if (loading) {
    return (
      <div className="paper-card rounded-2xl p-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-crimson" size={28} />
        <p className="text-sm text-paper-ink/60">Generating quiz from your review queue…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="paper-card rounded-2xl p-12 text-center">
        <p className="text-crimson mb-4">{error}</p>
        <button
          onClick={startQuiz}
          className="px-5 py-2.5 rounded-xl bg-crimson text-paper font-semibold hover:bg-crimson-soft"
        >
          Try again
        </button>
      </div>
    );
  }

  if (done) {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="paper-card rounded-2xl p-12 text-center">
        <BrainCircuit className="mx-auto text-crimson mb-4" size={40} />
        <h2 className="font-jp text-2xl text-indigo-dark mb-2">
          {pct >= 80 ? <GlossText>素晴らしい！</GlossText> : pct >= 50 ? <GlossText>よくできました！</GlossText> : <GlossText>もう一度！</GlossText>}
        </h2>
        <p className="text-4xl font-bold text-indigo-dark mb-2">
          {score} / {questions.length}
        </p>
        <p className="text-sm text-paper-ink/60 mb-6">Accuracy {pct}%</p>
        <div className="w-full max-w-xs mx-auto h-2 rounded-full bg-ink-line overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            className="h-full bg-crimson"
          />
        </div>
        <button
          onClick={startQuiz}
          className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson text-paper font-semibold hover:bg-crimson-soft"
        >
          <RefreshCw size={16} /> New quiz
        </button>
      </div>
    );
  }

  const q = questions[current];
  if (!q) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="px-3 py-2 rounded-xl bg-paper-card border border-ink-line outline-none text-sm"
        >
          <option value="all">All levels</option>
          <option value="N5">N5 only</option>
          <option value="N4">N4 only</option>
        </select>
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="px-3 py-2 rounded-xl bg-paper-card border border-ink-line outline-none text-sm"
        >
          <option value={5}>5 questions</option>
          <option value={10}>10 questions</option>
        </select>
        <button
          onClick={startQuiz}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-dark text-paper text-sm font-semibold hover:bg-indigo-mid"
        >
          <RefreshCw size={14} /> Regenerate
        </button>
      </div>

      <div className="paper-card rounded-2xl p-6">
        <div className="flex items-center justify-between text-xs text-paper-ink/50 mb-3">
          <span>
            Question {current + 1} / {questions.length}
          </span>
          <span className="font-semibold text-crimson">Score {score}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-ink-line overflow-hidden mb-5">
          <motion.div
            className="h-full bg-crimson"
            animate={{ width: `${((current + (selected !== null ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
        <p className="font-jp text-2xl leading-relaxed text-indigo-dark min-h-[4rem]">
          <GlossText>{q.prompt}</GlossText>
        </p>
      </div>

      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correctIndex;
            const isSelected = selected === i;
            let cls = "bg-paper-card border-ink-line hover:border-crimson hover:-translate-y-0.5";
            if (selected !== null) {
              if (isCorrect) cls = "bg-emerald-50 border-emerald-500 text-emerald-800";
              else if (isSelected) cls = "bg-crimson/10 border-crimson text-crimson";
              else cls = "bg-paper-card border-ink-line opacity-50";
            }
            return (
              <motion.button
                key={`${q.id}-${i}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => choose(i)}
                disabled={selected !== null}
                className={`p-4 rounded-xl border text-left font-medium transition-all ${cls}`}
              >
                <span className="inline-flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-dark/5 flex items-center justify-center text-xs">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-jp text-lg"><GlossText>{opt}</GlossText></span>
                  {selected !== null && isCorrect && (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  )}
                  {selected !== null && isSelected && !isCorrect && (
                    <XCircle size={18} className="text-crimson" />
                  )}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {selected !== null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-5 border ${
            selected === q.correctIndex
              ? "bg-emerald-50 border-emerald-200"
              : "bg-crimson/5 border-crimson/20"
          }`}
        >
          <div className="font-semibold mb-1 flex items-center gap-2">
            {selected === q.correctIndex ? (
              <>
                <CheckCircle2 size={18} className="text-emerald-600" /> Correct!
              </>
            ) : (
              <>
                <XCircle size={18} className="text-crimson" /> Not quite
              </>
            )}
          </div>
          <p className="text-mm text-[15px] leading-relaxed text-paper-ink">
            {q.explanation}
          </p>
          <button
            onClick={next}
            className="mt-4 px-5 py-2 rounded-xl bg-indigo-dark text-paper font-semibold hover:bg-indigo-mid"
          >
            {current + 1 >= questions.length ? "See results" : "Next question"}
          </button>
        </motion.div>
      )}
    </div>
  );
}
