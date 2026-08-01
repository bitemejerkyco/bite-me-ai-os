"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HelpModeToggle from "@/components/help/HelpModeToggle";
import type { HelpSearchResult } from "@/features/help/types";

export default function HelpCenterClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HelpSearchResult[]>([]);

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    void fetch(`/api/help/search?q=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => setResults(payload?.ok ? payload.results || [] : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [query]);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Searchable Help</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Search guidance, FAQs, and lessons</h2>
        </div>
        <HelpModeToggle />
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Connect TikTok, generate content, approve a post, upload a logo..."
        className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
      />
      <div className="mt-4 space-y-3">
        {(query.trim() ? results : []).length === 0 && query.trim() ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No direct match yet. Try the page name, a workflow action, or a glossary term.
          </p>
        ) : null}
        {(query.trim() ? results : []).map((result) => (
          <Link key={result.id} href={result.href} className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-violet-300">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{result.kind}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{result.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{result.body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
