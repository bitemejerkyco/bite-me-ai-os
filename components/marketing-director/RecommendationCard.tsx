"use client";

import Link from "next/link";
import { useState } from "react";
import { buildCustomerBriefRecommendation } from "@/features/marketing-director/customer-recommendations";
import type { MarketingRecommendation } from "@/features/marketing-director/daily-brief-rules";

export default function RecommendationCard({ recommendation }: { recommendation: MarketingRecommendation }) {
  const [showWhy, setShowWhy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const card = buildCustomerBriefRecommendation(recommendation);

  if (dismissed) return null;

  return (
    <article className="rounded-3xl border border-slate-200/90 bg-white/85 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          {card.impactLabel}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{card.summary}</p>
      {card.whyItMatters ? <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Why this matters:</span> {card.whyItMatters}</p> : null}
      {card.showConfidence ? <p className="mt-2 text-xs text-slate-500">Deterministic confidence: {(recommendation.confidence * 100).toFixed(0)}%</p> : null}

      {showWhy ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {(card.evidence || []).map((item) => (
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
