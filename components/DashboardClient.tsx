"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Flame,
  Layers,
  BookOpenText,
  BrainCircuit,
  FileSearch,
  Target,
  Trophy,
} from "lucide-react";
import { GlossText } from "@/components/GlossText";
import { ProgressRing } from "./ProgressRing";

export interface DashboardStats {
  totalVocab: number;
  n5: number;
  n4: number;
  dueCards: number;
  learning: number;
  reviewing: number;
  mastered: number;
  streak: number;
  todayWords: number;
  todayQuizzes: number;
  todayAccuracy: number;
}

export function DashboardClient({ stats }: { stats: DashboardStats }) {
  const [target, setTarget] = useState(20);
  const [difficulty, setDifficulty] = useState(50);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const t = Number(localStorage.getItem("waku-target"));
      const d = Number(localStorage.getItem("waku-difficulty"));
      if (t && t > 0) setTarget(t);
      if (d) setDifficulty(d);
      setHydrated(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const saveTarget = (v: number) => {
    setTarget(v);
    localStorage.setItem("waku-target", String(v));
  };
  const saveDifficulty = (v: number) => {
    setDifficulty(v);
    localStorage.setItem("waku-difficulty", String(v));
  };

  const overall = stats.totalVocab ? Math.round((stats.mastered / stats.totalVocab) * 100) : 0;
  const n5pct = stats.n5 ? Math.round(((stats.n5) / stats.totalVocab) * 100) : 0;
  const n4pct = stats.n4 ? Math.round(((stats.n4) / stats.totalVocab) * 100) : 0;
  const dailyPct = target ? Math.min(100, Math.round((stats.todayWords / target) * 100)) : 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="paper-card rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute -right-8 -top-10 text-[10rem] font-jp text-crimson/5 select-none leading-none">
          和
        </div>
        <p className="text-sm tracking-widest text-crimson font-semibold uppercase">
          Wagaku · <GlossText>日本語学習</GlossText>
        </p>
        <h1 className="font-jp text-4xl text-indigo-dark mt-2">
          {new Date().getHours() < 12 ? <GlossText>おはようございます</GlossText> : new Date().getHours() < 18 ? <GlossText>こんにちは</GlossText> : <GlossText>こんばんは</GlossText>}
        </h1>
        <p className="mt-2 text-paper-ink/70 text-sm">
          {hydrated
            ? `You're ${stats.todayWords} / ${target} words into today's goal.`
            : "Loading your daily goal…"}
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link
            href="/flashcards"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-crimson text-paper font-semibold hover:bg-crimson-soft transition-colors shadow-md shadow-crimson/20"
          >
            <Layers size={17} /> Study flashcards
          </Link>
          <Link
            href="/quiz"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-dark text-paper font-semibold hover:bg-indigo-mid transition-colors"
          >
            <BrainCircuit size={17} /> Take a quiz
          </Link>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Flame size={20} />} label="Day streak" value={String(stats.streak)} tone="crimson" />
        <StatCard icon={<Target size={20} />} label="Due cards" value={String(stats.dueCards)} tone="indigo" />
        <StatCard icon={<Trophy size={20} />} label="Mastered" value={String(stats.mastered)} tone="crimson" />
        <StatCard icon={<BrainCircuit size={20} />} label="Quiz accuracy" value={`${Math.round(stats.todayAccuracy * 100)}%`} tone="indigo" />
      </section>

      {/* Progress rings */}
      <section className="grid md:grid-cols-3 gap-4">
        <div className="paper-card paper-card-hover rounded-2xl p-6 flex flex-col items-center gap-4">
          <ProgressRing value={overall} color="var(--color-crimson)">
            <span className="text-3xl font-bold text-indigo-dark">{overall}%</span>
            <span className="text-[11px] text-paper-ink/50">overall</span>
          </ProgressRing>
          <div className="text-center">
            <div className="font-jp text-indigo-dark font-semibold">Mastery progress</div>
            <div className="text-xs text-paper-ink/60 mt-1">
              {stats.mastered} / {stats.totalVocab} mastered
            </div>
          </div>
        </div>
        <div className="paper-card paper-card-hover rounded-2xl p-6 flex flex-col items-center gap-4">
          <ProgressRing value={n5pct} color="var(--color-indigo-mid)">
            <span className="text-3xl font-bold text-indigo-dark">{stats.n5}</span>
            <span className="text-[11px] text-paper-ink/50">words</span>
          </ProgressRing>
          <div className="text-center">
            <div className="font-jp text-indigo-dark font-semibold">JLPT N5</div>
            <div className="text-xs text-paper-ink/60 mt-1">{(stats.n5 / Math.max(stats.totalVocab, 1) * 100).toFixed(0)}% of deck</div>
          </div>
        </div>
        <div className="paper-card paper-card-hover rounded-2xl p-6 flex flex-col items-center gap-4">
          <ProgressRing value={n4pct} color="var(--color-crimson-soft)">
            <span className="text-3xl font-bold text-indigo-dark">{stats.n4}</span>
            <span className="text-[11px] text-paper-ink/50">words</span>
          </ProgressRing>
          <div className="text-center">
            <div className="font-jp text-indigo-dark font-semibold">JLPT N4</div>
            <div className="text-xs text-paper-ink/60 mt-1">{(stats.n4 / Math.max(stats.totalVocab, 1) * 100).toFixed(0)}% of deck</div>
          </div>
        </div>
      </section>

      {/* Daily target + settings */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="paper-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-indigo-dark">Daily target</h3>
            <span className="text-2xl font-bold text-crimson">{target}</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={target}
            onChange={(e) => saveTarget(Number(e.target.value))}
            className="w-full accent-crimson"
          />
          <div className="mt-4">
            <div className="flex justify-between text-xs text-paper-ink/60 mb-1.5">
              <span>Words reviewed today</span>
              <span>
                {stats.todayWords} / {target}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-ink-line overflow-hidden">
              <div
                className="h-full bg-crimson transition-all duration-500"
                style={{ width: `${dailyPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="paper-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-indigo-dark">Quiz difficulty ratio</h3>
            <span className="text-2xl font-bold text-indigo-mid">{difficulty}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={10}
            value={difficulty}
            onChange={(e) => saveDifficulty(Number(e.target.value))}
            className="w-full accent-indigo-dark"
          />
          <div className="flex justify-between text-xs text-paper-ink/60 mt-2">
            <span>Beginner · more N5</span>
            <span>Hard · more gap-fill</span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-paper-ink/50">
            <FileSearch size={14} />
            PDFs are scanned from your Desktop folder · run ingest to add words
          </div>
        </div>
      </section>

      {/* Quick navigation */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/reader", icon: BookOpenText, title: "Interactive Reader", desc: "Hoverable Burmese glosses", accent: "crimson" },
          { href: "/flashcards", icon: Layers, title: "Flashcards", desc: `${stats.dueCards} cards due now`, accent: "indigo" },
          { href: "/quiz", icon: BrainCircuit, title: "AI Quizzes", desc: "Procedurally generated", accent: "crimson" },
          { href: "/ingest", icon: FileSearch, title: "PDF Ingest", desc: "Scan your study materials", accent: "indigo" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className={`paper-card paper-card-hover rounded-2xl p-5 border-t-4 ${
                c.accent === "crimson" ? "border-t-crimson" : "border-t-indigo-dark"
              }`}
            >
              <Icon size={22} className={c.accent === "crimson" ? "text-crimson" : "text-indigo-dark"} />
              <div className="font-semibold text-indigo-dark mt-3">{c.title}</div>
              <div className="text-xs text-paper-ink/60 mt-1">{c.desc}</div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "crimson" | "indigo";
}) {
  return (
    <div className="paper-card paper-card-hover rounded-2xl p-5">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
          tone === "crimson" ? "bg-crimson/10 text-crimson" : "bg-indigo-dark/10 text-indigo-dark"
        }`}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold text-indigo-dark">{value}</div>
      <div className="text-xs text-paper-ink/60 mt-0.5">{label}</div>
    </div>
  );
}
