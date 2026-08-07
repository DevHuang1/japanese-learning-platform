"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";

export interface VocabRow {
  id: string;
  kanji: string | null;
  kana: string;
  romaji: string | null;
  burmeseMeaning: string;
  jlptLevel: string;
  partOfSpeech: string | null;
  pdfSource: string | null;
  status: string;
  nextReviewDate: string | null;
}

export function VocabularyList({ rows }: { rows: VocabRow[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (level !== "all" && r.jlptLevel !== level) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return [r.kanji, r.kana, r.romaji, r.burmeseMeaning, r.partOfSpeech]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [rows, query, level, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-paper-ink/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search kanji, kana, romaji or Burmese…"
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
          <option value="learning">Learning</option>
          <option value="reviewing">Reviewing</option>
          <option value="mastered">Mastered</option>
        </select>
      </div>

      <div className="paper-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-paper-ink/50 border-b border-ink-line bg-paper-deep/40">
                <th className="px-5 py-3">Japanese</th>
                <th className="px-5 py-3">Burmese</th>
                <th className="px-5 py-3">Level</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-ink-line/60 last:border-0 hover:bg-paper-deep/30 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="font-jp text-lg text-indigo-dark">
                      {r.kanji ?? r.kana}
                    </div>
                    <div className="text-xs text-paper-ink/50">
                      {r.kana}
                      {r.romaji ? ` · ${r.romaji}` : ""}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-mm text-base text-paper-ink">
                    {r.burmeseMeaning}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        r.jlptLevel === "N5"
                          ? "bg-crimson/10 text-crimson"
                          : "bg-indigo-dark/10 text-indigo-dark"
                      }`}
                    >
                      N{r.jlptLevel.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-paper-ink/60">
                    {r.partOfSpeech ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs ${
                        r.status === "mastered"
                          ? "text-emerald-600"
                          : r.status === "reviewing"
                            ? "text-indigo-mid"
                            : "text-amber-600"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          r.status === "mastered"
                            ? "bg-emerald-500"
                            : r.status === "reviewing"
                              ? "bg-indigo-mid"
                              : "bg-amber-500"
                        }`}
                      />
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-paper-ink/50 max-w-[120px] truncate">
                    {r.pdfSource ?? "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-paper-ink/50">
                    No words match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-paper-ink/50">
        {filtered.length} of {rows.length} words
      </p>
    </div>
  );
}
