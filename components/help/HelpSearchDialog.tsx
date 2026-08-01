"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHelp } from "@/components/help/HelpContext";
import type { HelpSearchResult } from "@/features/help/types";

export default function HelpSearchDialog() {
  const { searchOpen, closeSearch } = useHelp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HelpSearchResult[]>([]);

  useEffect(() => {
    if (!searchOpen) return;
    if (!query.trim()) return;
    const controller = new AbortController();
    void fetch(`/api/help/search?q=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => setResults(payload?.ok ? payload.results || [] : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [query, searchOpen]);

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-[85] grid place-items-start bg-slate-900/35 px-4 py-10" role="dialog" aria-modal="true" aria-label="Help search">
      <div className="w-full max-w-3xl rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Help Search</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Search guidance, FAQs, steps, and lessons</h2>
          </div>
          <button type="button" onClick={closeSearch} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Close</button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Connect TikTok, approve a post, buy credits, upload a logo..."
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
        />
        <div className="mt-4 space-y-3">
          {(query.trim() ? results : []).length === 0 && query.trim() ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No exact match yet. Try searching for the page, term, or action you expect to take.</p>
          ) : null}
          {(query.trim() ? results : []).map((result) => (
            <Link key={result.id} href={result.href} onClick={closeSearch} className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-violet-300">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>{result.kind}</span>
                {result.relatedLessonId ? <span>Lesson available</span> : null}
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{result.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{result.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
