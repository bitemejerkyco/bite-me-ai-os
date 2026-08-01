"use client";

import Link from "next/link";
import { useState } from "react";
import type { MarketingRecommendation } from "@/features/marketing-director/daily-brief-rules";

export default function RecommendationCard({ recommendation }: { recommendation: MarketingRecommendation }) {
  const [showWhy, setShowWhy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <article className="rounded-3xl border border-slate-200/90 bg-white/85 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-900">{recommendation.title}</h3>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          {recommendation.expectedImpact}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{recommendation.summary}</p>
      <p className="mt-2 text-sm text-slate-600">{recommendation.reason}</p>
      <p className="mt-2 text-xs text-slate-500">Confidence: {(recommendation.confidence * 100).toFixed(0)}%</p>

      {showWhy ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {recommendation.evidence.slice(0, 3).map((item) => (
            <li key={`${recommendation.id}-${item.label}`}>{item.label}: {item.value}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={recommendation.actionHref}
          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-violet-200 bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 active:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {recommendation.actionLabel || "Open recommendation"}
        </Link>
        <button
          type="button"
          onClick={() => setShowWhy((current) => !current)}
          aria-expanded={showWhy}
          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {showWhy ? "Hide why" : "Explain why"}
        </button>
        {!recommendation.requiresApproval ? (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            Dismiss
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            Defer for now
          </button>
        )}
      </div>
    </article>
  );
}
