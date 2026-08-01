"use client";

import Link from "next/link";
import { useState } from "react";
import type { DailyBrief } from "@/features/marketing-director/daily-brief-rules";

export default function DailyBriefPanel({ brief }: { brief: DailyBrief }) {
  const [currentBrief, setCurrentBrief] = useState(brief);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshBrief() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/marketing-director/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh: true }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        brief?: DailyBrief;
      } | null;
      if (!response.ok || !payload?.ok || !payload.brief) {
        setError(payload?.error || "Unable to refresh executive brief right now.");
        return;
      }
      setCurrentBrief(payload.brief);
    } catch {
      setError("Unable to refresh executive brief right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Daily Executive Brief</p>
        <div className="flex items-center gap-2">
          <Link href="/analytics/executive-brief" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">
            View full brief
          </Link>
          <button
            type="button"
            onClick={() => void refreshBrief()}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh brief"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      {currentBrief.metrics.length === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white/85 p-3 text-sm text-slate-600">
          Executive brief data is not available yet for this workspace.
        </p>
      ) : null}

      <p className="mt-2 text-sm text-slate-600">Generated {new Date(currentBrief.generatedAt).toLocaleString()}</p>
      <p className="mt-1 text-sm text-slate-600">{currentBrief.dataCoverageSummary}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Snapshot summary</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {currentBrief.metrics.map((metric) => (
              <li key={metric.id}>{metric.label}: {metric.value}</li>
            ))}
            <li>{currentBrief.scoreDeltaLabel}</li>
            <li>{currentBrief.bestPerformanceSignal}</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Needs attention</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {currentBrief.needsAttention.length === 0 ? <li>Nothing urgent right now.</li> : currentBrief.needsAttention.map((line) => <li key={line}>{line}</li>)}
            {currentBrief.recommendedNextAction ? (
              <li>
                Next action: {currentBrief.recommendedNextAction.title}
              </li>
            ) : null}
            {currentBrief.revenueAvailability === "unavailable" ? (
              <li>Revenue impact is unavailable from connected data.</li>
            ) : null}
            {currentBrief.missingIntegrations.length > 0 ? (
              <li>Missing integrations: {currentBrief.missingIntegrations.join(", ")}</li>
            ) : null}
          </ul>
        </article>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/85 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Since last visit</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {currentBrief.sinceLastVisit.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
      </div>
    </section>
  );
}
