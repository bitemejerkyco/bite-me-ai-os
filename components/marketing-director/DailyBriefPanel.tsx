"use client";

import Link from "next/link";
import { useState } from "react";
import AIThinkingProgress from "@/components/marketing-director/AIThinkingProgress";
import type { DailyBrief } from "@/features/marketing-director/daily-brief-rules";

export default function DailyBriefPanel({
  brief,
  greeting,
  firstName,
}: {
  brief: DailyBrief;
  greeting: string;
  firstName: string;
}) {
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
    <section data-help="dashboard-executive-brief" className="pm-glass-premium rounded-[2rem] border border-white/90 bg-white/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Executive Brief</p>
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
            {loading ? "Refreshing intelligence..." : "Refresh executive brief"}
          </button>
        </div>
      </div>

      <AIThinkingProgress active={loading} title="Preparing your executive brief" />

      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      {currentBrief.metrics.length === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white/85 p-3 text-sm text-slate-600">
          PostMotive currently has limited connected performance data.
        </p>
      ) : null}

      <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
        <p className="text-sm font-semibold text-violet-900">{greeting}, {firstName}.</p>
        <p className="mt-1.5 text-sm leading-6 text-violet-900">{currentBrief.executiveNarrative}</p>
      </div>

      <p className="mt-2 text-sm text-slate-600">Generated {new Date(currentBrief.generatedAt).toLocaleString()}</p>
      <p className="mt-1 text-sm text-slate-600">{currentBrief.dataCoverageSummary}</p>
      <p className="mt-1 text-sm text-slate-700">{currentBrief.urgency.summary}</p>

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
            {currentBrief.needsAttention.length === 0
              ? <li>No critical issues are currently flagged by connected records.</li>
              : currentBrief.needsAttention.map((line) => <li key={line}>{line}</li>)}
            {currentBrief.recommendedNextAction ? (
              <li>
                Next action: {currentBrief.recommendedNextAction.title}
              </li>
            ) : null}
            {currentBrief.revenueAvailability === "unavailable" ? (
              <li>Revenue tracking is not connected yet.</li>
            ) : null}
            {currentBrief.missingIntegrations.length > 0 ? (
              <li>Missing integrations: {currentBrief.missingIntegrations.join(", ")}</li>
            ) : null}
          </ul>
          {currentBrief.revenueAvailability === "unavailable" ? (
            <Link href="/integrations" className="mt-3 inline-flex rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">
              Connect Revenue Source
            </Link>
          ) : null}
        </article>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/85 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Since Your Last Visit</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {currentBrief.sinceLastVisit.length === 0 || currentBrief.sinceLastVisit.every((line) => /0\s+/u.test(line)) ? (
            <>
              <li>No meaningful changes have been recorded yet.</li>
              <li>PostMotive will summarize new drafts, approvals, scheduled posts, publishing results, and integration changes here.</li>
            </>
          ) : currentBrief.sinceLastVisit.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Executive morning brief</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {(currentBrief.morningBrief.overnightChanges.length > 0 ? currentBrief.morningBrief.overnightChanges : [
              "Review pending content to keep approvals moving.",
              "Complete product setup to unlock product-specific campaigns.",
              "Connect Amazon Ads or another analytics-enabled channel to improve recommendations.",
            ]).slice(0, 3).map((line) => (
              <li key={line}>{line}</li>
            ))}
            {currentBrief.morningBrief.wins.slice(0, 2).map((line) => (
              <li key={line}>Win: {line}</li>
            ))}
            {currentBrief.morningBrief.risks.slice(0, 2).map((line) => (
              <li key={line}>Risk: {line}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI guidance</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {(currentBrief.morningBrief.urgentActions.length > 0 ? currentBrief.morningBrief.urgentActions : [
              "Complete your product catalog to unlock product-specific campaigns.",
              "Upload your logo to improve branded creative generation.",
              "Connect Amazon Ads to unlock paid media insights.",
              "Approve pending drafts to keep the publishing calendar moving.",
              "Connect an analytics source to improve recommendation confidence.",
            ]).slice(0, 2).map((line) => (
              <li key={line}>Urgent: {line}</li>
            ))}
            {(currentBrief.morningBrief.opportunities.length > 0 ? currentBrief.morningBrief.opportunities : [
              "Connect more marketing channels to improve PostMotive recommendations.",
            ]).slice(0, 2).map((line) => (
              <li key={line}>Opportunity: {line}</li>
            ))}
            <li>{currentBrief.morningBrief.estimatedBusinessImpact || "PostMotive will update impact guidance as connected data improves."}</li>
          </ul>
          <Link href="/integrations" className="mt-3 inline-flex rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">
            Manage Integrations
          </Link>
        </article>
      </div>
    </section>
  );
}
