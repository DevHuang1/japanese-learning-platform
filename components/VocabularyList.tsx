"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Volume2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Loader2,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { GlossText } from "@/components/GlossText";

export interface VocabRow {
  id: string;
  kanji: string | null;
  kana: string;
  romaji: string | null;
  burmeseMeaning: string;
  jlptLevel: string;
  partOfSpeech: string | null;
  exampleSentenceJp: string | null;
  exampleSentenceMm: string | null;
  pdfSource: string | null;
  lesson: number | null;
  status: string;
  nextReviewDate: string | null;
}

type Status = "learning" | "reviewing" | "mastered";

const STATUS_LABEL: Record<Status, string> = {
  learning: "学習",
  reviewing: "復習",
  mastered: "習得",
};

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 0.85;
  const voices = window.speechSynthesis.getVoices();
  const jp = voices.find((v) => v.lang.startsWith("ja"));
  if (jp) u.voice = jp;
  window.speechSynthesis.speak(u);
}

export function VocabularyList({ rows }: { rows: VocabRow[] }) {
  const [items, setItems] = useState<VocabRow[]>(rows);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");
  const [lesson, setLesson] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        rows.map((r) => (r.lesson ? `lesson-${r.lesson}` : "unassigned"))
      )
  );
  const [showSentences, setShowSentences] = useState<Set<string>>(new Set());
  const [busyStatus, setBusyStatus] = useState<string | null>(null);

  const lessonOptions = useMemo(() => {
    const set = new Set<number>();
    for (const r of items) if (r.lesson) set.add(r.lesson);
    return [...set].sort((a, b) => a - b);
  }, [items]);

  const hasUnassigned = useMemo(
    () => items.some((r) => r.lesson === null),
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (level !== "all" && r.jlptLevel !== level) return false;
      if (status !== "all" && r.status !== status) return false;
      if (lesson === "unassigned" && r.lesson !== null) return false;
      if (lesson !== "all" && lesson !== "unassigned" && r.lesson !== Number(lesson))
        return false;
      if (!q) return true;
      return [r.kanji, r.kana, r.romaji, r.burmeseMeaning, r.partOfSpeech, r.pdfSource]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [items, query, level, status, lesson]);

  const groups = useMemo(() => {
    const map = new Map<string, VocabRow[]>();
    for (const r of filtered) {
      const key = r.lesson ? `lesson-${r.lesson}` : "unassigned";
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return [...map.entries()]
      .sort((a, b) => {
        if (a[0] === "unassigned") return 1;
        if (b[0] === "unassigned") return -1;
        return Number(a[0].split("-")[1]) - Number(b[0].split("-")[1]);
      })
      .map(([key, list]) => {
        const sorted = [...list].sort((a, b) =>
          a.kana.localeCompare(b.kana, "ja")
        );
        return [key, sorted] as [string, VocabRow[]];
      });
  }, [filtered]);

  const toggleGroup = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const expandAll = () =>
    setExpanded(new Set(items.map((r) => (r.lesson ? `lesson-${r.lesson}` : "unassigned"))));

  const collapseAll = () => setExpanded(new Set());

  const changeStatus = async (row: VocabRow, next: Status) => {
    setBusyStatus(row.id);
    try {
      const res = await fetch("/api/vocabulary/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabId: row.id, status: next }),
      });
      if (!res.ok) throw new Error("status update failed");
      setItems((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: next } : r))
      );
    } catch {
      // keep previous status
    } finally {
      setBusyStatus(null);
    }
  };

  const lessonLabel = (key: string) =>
    key === "unassigned"
      ? { title: "未分類", subtitle: "Unassigned" }
      : { title: `第${key.split("-")[1]}課`, subtitle: `Lesson ${key.split("-")[1]}` };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-paper-ink/40"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search kanji, kana, romaji, Burmese or source…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-paper-card border border-ink-line outline-none focus:border-crimson transition-colors"
          />
        </div>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-paper-card border border-ink-line outline-none text-sm"
        >
          <option value="all">All levels</option>
          <option value="N5">N5</option>
          <option value="N4">N4</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-paper-card border border-ink-line outline-none text-sm"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-paper-card border border-ink-line outline-none text-sm"
        >
          <option value="all">All chapters</option>
          {lessonOptions.map((n) => (
            <option key={n} value={n}>
              第{n}課 · Lesson {n}
            </option>
          ))}
          {hasUnassigned && <option value="unassigned">未分類 · Unassigned</option>}
        </select>
        <button
          onClick={expanded.size === groups.length ? collapseAll : expandAll}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-paper-card border border-ink-line text-sm text-paper-ink/70 hover:text-crimson transition-colors"
        >
          {expanded.size === groups.length && groups.length > 0 ? (
            <ChevronsDownUp size={15} />
          ) : (
            <ChevronsUpDown size={15} />
          )}
          {expanded.size === groups.length && groups.length > 0
            ? "Collapse all"
            : "Expand all"}
        </button>
      </div>

      <div className="space-y-3">
        {groups.map(([key, list]) => {
          const isOpen = expanded.has(key);
          const label = lessonLabel(key);
          const mastered = list.filter((r) => r.status === "mastered").length;
          const lessonNum = key === "unassigned" ? null : Number(key.split("-")[1]);

          return (
            <div key={key} className="paper-card rounded-2xl overflow-hidden">
              <div
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 cursor-pointer select-none hover:bg-paper-deep/40 transition-colors"
                onClick={() => toggleGroup(key)}
              >
                <div className="flex items-center gap-3">
                  {isOpen ? (
                    <ChevronDown size={18} className="text-crimson" />
                  ) : (
                    <ChevronRight size={18} className="text-paper-ink/40" />
                  )}
                  <div>
                    <div className="font-jp text-lg text-indigo-dark leading-none">
                      {label.title}
                    </div>
                    <div className="text-xs text-paper-ink/50 mt-1">
                      {label.subtitle} · {list.length} words · {mastered} mastered
                    </div>
                  </div>
                </div>
                {lessonNum && (
                  <a
                    href={`/flashcards?lesson=${lessonNum}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-crimson/10 text-crimson text-sm font-semibold hover:bg-crimson/20 transition-colors"
                  >
                    <BookOpen size={15} />
                    Study chapter
                  </a>
                )}
              </div>

              {isOpen && (
                <div className="border-t border-ink-line/60">
                  {list.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap lg:flex-nowrap items-start gap-x-6 gap-y-3 px-5 py-4 border-b border-ink-line/60 last:border-0 hover:bg-paper-deep/30 transition-colors"
                    >
                      <div className="flex-1 min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => speak(r.kana)}
                            title="Listen"
                            className="shrink-0 w-9 h-9 rounded-full bg-indigo-dark/5 text-indigo-dark hover:bg-crimson/10 hover:text-crimson flex items-center justify-center transition-colors"
                          >
                            <Volume2 size={16} />
                          </button>
                          <div>
                            <div className="font-jp text-2xl text-indigo-dark leading-none">
                              <GlossText>{r.kanji ?? r.kana}</GlossText>
                            </div>
                            <div className="text-sm text-paper-ink/60 mt-1.5">
                              {r.kana}
                              {r.romaji ? ` · ${r.romaji}` : ""}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 min-w-[180px]">
                        <div className="text-mm text-lg text-paper-ink leading-snug">
                          {r.burmeseMeaning}
                        </div>
                        {r.exampleSentenceJp && (
                          <button
                            onClick={() =>
                              setShowSentences((prev) => {
                                const next = new Set(prev);
                                if (next.has(r.id)) next.delete(r.id);
                                else next.add(r.id);
                                return next;
                              })
                            }
                            className="mt-1.5 text-xs text-crimson font-medium hover:underline"
                          >
                            {showSentences.has(r.id)
                              ? "Hide example"
                              : "Show example"}
                          </button>
                        )}
                        {showSentences.has(r.id) && r.exampleSentenceJp && (
                          <div className="mt-2 space-y-1 rounded-xl bg-paper-deep/50 p-3">
                            <div className="text-jp text-sm text-indigo-mid">
                              <GlossText>{r.exampleSentenceJp}</GlossText>
                            </div>
                            {r.exampleSentenceMm && (
                              <div className="text-mm text-sm text-paper-ink/70">
                                {r.exampleSentenceMm}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-start lg:items-end gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              r.jlptLevel === "N5"
                                ? "bg-crimson/10 text-crimson"
                                : "bg-indigo-dark/10 text-indigo-dark"
                            }`}
                          >
                            N{r.jlptLevel.slice(1)}
                          </span>
                          {r.partOfSpeech && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-paper-deep text-paper-ink/70">
                              {r.partOfSpeech}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 rounded-full border border-ink-line overflow-hidden bg-paper-card">
                          {(["learning", "reviewing", "mastered"] as Status[]).map(
                            (s) => (
                              <button
                                key={s}
                                disabled={busyStatus === r.id}
                                onClick={() => changeStatus(r, s)}
                                className={`px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                  r.status === s
                                    ? s === "mastered"
                                      ? "bg-emerald-500 text-white"
                                      : s === "reviewing"
                                        ? "bg-indigo-mid text-white"
                                        : "bg-amber-500 text-white"
                                    : "text-paper-ink/50 hover:bg-paper-deep hover:text-paper-ink"
                                }`}
                              >
                                {STATUS_LABEL[s]}
                              </button>
                            )
                          )}
                        </div>
                        <div className="text-xs text-paper-ink/40">
                          {busyStatus === r.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            (r.pdfSource ?? "—")
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="paper-card rounded-2xl py-14 text-center text-paper-ink/50">
            No words match your filters.
          </div>
        )}
      </div>

      <p className="text-xs text-paper-ink/50">
        {filtered.length} of {items.length} words · {groups.length}{" "}
        {groups.length === 1 ? "chapter" : "chapters"}
      </p>
    </div>
  );
}
