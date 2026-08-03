"use client";

import Link from "next/link";
import { useState } from "react";
import AIThinkingProgress from "@/components/marketing-director/AIThinkingProgress";
import type { DailyBrief } from "@/features/marketing-director/daily-brief-rules";

const DEPRECATED_COPY = [
  /Coverage summary unavailable/iu,
  /Revenue impact unavailable/iu,
  /No prior snapshot/iu,
  /No strong performance signal/iu,
];

function hasDeprecatedCopy(value: string): boolean {
  return DEPRECATED_COPY.some((pattern) => pattern.test(value));
}

function fallbackSummary(brief: DailyBrief): string {
  const topNeed = brief.needsAttention[0] || "reviewing pending content";
  const missing = brief.missingIntegrations.length > 0
    ? `${brief.missingIntegrations[0]} coverage is limited`
    : "connected data coverage is still building";
  return `Your immediate priority is ${topNeed.toLowerCase()}. PostMotive found no urgent blockers, but ${missing} and this is reducing recommendation confidence.`;
}

function effectiveNarrative(brief: DailyBrief): string {
  const candidate = String(brief.executiveNarrative || "").trim();
  if (!candidate || hasDeprecatedCopy(candidate)) {
    return fallbackSummary(brief);
  }
  return candidate;
}

function metricById(brief: DailyBrief, id: string): DailyBrief["metrics"][number] | null {
  return brief.metrics.find((metric) => metric.id === id) || null;
}

function firstCount(input: string): number | null {
  const match = input.match(/-?\d+/u);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function scheduledContentCount(brief: DailyBrief): number | null {
  const scheduledLine = brief.sinceLastVisit.find((line) => /scheduled post/iu.test(line));
  if (!scheduledLine) return null;
  return firstCount(scheduledLine);
}

function safeSinceLastVisit(brief: DailyBrief): string[] {
  return brief.sinceLastVisit
    .filter((line) => !/^0\s+/u.test(line.trim()))
    .filter((line) => !hasDeprecatedCopy(line))
    .slice(0, 4);
}

function priorityCta(brief: DailyBrief): { label: string; href: string; detail: string; badge?: string } {
  if (brief.recommendedNextAction) {
    return {
      label: brief.recommendedNextAction.ctaLabel || "Review Priority",
      href: brief.recommendedNextAction.href || "/media?tab=CONTENT_DRAFTS",
      detail: brief.recommendedNextAction.title,
      badge: brief.urgency.hasUrgentWork ? brief.urgency.label : undefined,
    };
  }

  return {
    label: "Complete Product Setup",
    href: "/products",
    detail: "Complete product setup to improve campaign and recommendation quality.",
    badge: "Foundational",
  };
}

function attentionCta(brief: DailyBrief): { label: string; href: string; detail: string; badge?: string } {
  if (brief.missingIntegrations.length > 0) {
    return {
      label: "Complete Product Setup",
      href: "/products",
      detail: "Your product catalog is incomplete, limiting product-specific recommendations.",
      badge: "Coverage",
    };
  }

  if (brief.needsAttention.length > 0) {
    return {
      label: "Review Queue",
      href: "/media?tab=CONTENT_DRAFTS",
      detail: brief.needsAttention[0],
      badge: brief.urgency.hasUrgentWork ? "High" : "Review",
    };
  }

  return {
    label: "Review Dashboard",
    href: "/analytics/executive-brief",
    detail: "No immediate blockers are detected; monitor execution and approvals to keep momentum.",
  };
}

function aiGuidance(brief: DailyBrief): { recommendation: string; reason: string; href: string; cta: string } {
  const recommendation = brief.morningBrief.urgentActions[0]
    || "Complete your product catalog to unlock product-specific campaigns and stronger recommendations.";
  const reason = brief.missingIntegrations.length > 0
    ? `PostMotive currently has limited ${brief.missingIntegrations[0]} context.`
    : "PostMotive currently has limited product context.";
  return {
    recommendation,
    reason,
    href: "/products",
    cta: "Complete Product Setup",
  };
}

function supportText(input: { metric: DailyBrief["metrics"][number] | null; fallback: string }): string {
  if (!input.metric) return input.fallback;
  if (hasDeprecatedCopy(input.metric.note)) return input.fallback;
  return input.metric.note;
}

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
  const [collapsedMobile, setCollapsedMobile] = useState(false);

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

  const narrative = effectiveNarrative(currentBrief);
  const scoreMetric = metricById(currentBrief, "marketing-score");
  const campaignsMetric = metricById(currentBrief, "active-campaigns");
  const approvalsMetric = metricById(currentBrief, "approval-queue");
  const scheduledValue = scheduledContentCount(currentBrief);
  const priority = priorityCta(currentBrief);
  const attention = attentionCta(currentBrief);
  const guidance = aiGuidance(currentBrief);
  const sinceLastVisit = safeSinceLastVisit(currentBrief);

  const metricCards = [
    {
      id: "marketing-score",
      label: "Marketing Score",
      value: scoreMetric?.value || "Not measured",
      support: supportText({ metric: scoreMetric, fallback: "Confidence is based on connected data sources." }),
      trend: scoreMetric?.trend,
    },
    {
      id: "active-campaigns",
      label: "Active Campaigns",
      value: campaignsMetric?.value || "0",
      support: supportText({ metric: campaignsMetric, fallback: "Real campaign records" }),
      trend: campaignsMetric?.trend,
    },
    {
      id: "awaiting-approval",
      label: "Awaiting Approval",
      value: approvalsMetric?.value || "0",
      support: supportText({ metric: approvalsMetric, fallback: "Draft + schedule approval queue" }),
      trend: approvalsMetric?.trend,
    },
    {
      id: "scheduled-content",
      label: "Scheduled Content",
      value: scheduledValue === null ? "Not measured" : String(scheduledValue),
      support: "Recent scheduled post activity",
      trend: "unknown" as const,
    },
  ];

  return (
    <section
      data-help="dashboard-executive-brief"
      aria-label="Executive Brief"
      className="pm-glass-premium rounded-[1.5rem] border border-white/90 bg-white/85 p-5 sm:p-6"
    >
      <div className="sticky top-0 z-10 -mx-2 -mt-2 flex flex-wrap items-start justify-between gap-3 bg-white/90 px-2 pt-2 pb-3 backdrop-blur">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Executive Brief</p>
          <p className="mt-1 text-sm text-slate-600">A concise summary of what matters most right now.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsedMobile((value) => !value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:hidden"
          >
            {collapsedMobile ? "Expand" : "Collapse"}
          </button>
          <button
            type="button"
            onClick={() => void refreshBrief()}
            disabled={loading}
            aria-label="Refresh executive brief"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link
            href="/analytics/executive-brief"
            aria-label="View full executive brief"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View Full Brief
          </Link>
        </div>
      </div>

      <div className={`${collapsedMobile ? "hidden sm:block" : "block"}`}>
      <div className="relative mt-1">
      <div className="max-h-[36rem] overflow-y-auto pr-1">
      <AIThinkingProgress active={loading} title="Preparing your executive brief" />

      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      {loading ? (
        <div className="mt-4 space-y-4" aria-label="Executive Brief loading skeleton" aria-busy="true">
          <div className="space-y-2">
            <div className="pm-skeleton h-7 w-56" />
            <div className="pm-skeleton h-4 w-full" />
            <div className="pm-skeleton h-4 w-11/12" />
          </div>
          <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <article key={index} className="rounded-xl border border-slate-200 bg-white/85 p-3">
                <div className="pm-skeleton h-3 w-24" />
                <div className="mt-2 pm-skeleton h-7 w-20" />
                <div className="mt-2 pm-skeleton h-3 w-full" />
              </article>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <article key={index} className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                <div className="pm-skeleton h-4 w-32" />
                <div className="mt-2 pm-skeleton h-4 w-full" />
                <div className="mt-2 pm-skeleton h-4 w-5/6" />
                <div className="mt-3 pm-skeleton h-8 w-36" />
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">{greeting}, {firstName}.</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">{narrative}</p>
          </div>

          <section aria-label="Executive Brief key metrics" className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1 lg:grid-cols-4">
            {metricCards.map((metric) => (
              <article key={metric.id} className="rounded-xl border border-slate-200 bg-white/88 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                <p className="pm-number-pop mt-1 text-2xl font-black tracking-tight text-slate-900">{metric.value}</p>
                <p className="mt-1 text-xs text-slate-600">{metric.support}</p>
                {metric.trend && metric.trend !== "unknown" ? (
                  <p className="mt-1 text-[11px] font-semibold text-slate-500" aria-label={`Trend ${metric.trend}`}>
                    {metric.trend === "up" ? "Up" : metric.trend === "down" ? "Down" : "Stable"}
                  </p>
                ) : null}
              </article>
            ))}
          </section>

          <section className="grid gap-3 lg:grid-cols-2" aria-label="Priority and attention">
            <article className="rounded-2xl border border-slate-200 bg-white/88 p-4" aria-label="Top Priority">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">Top Priority</h3>
                {priority.badge ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">{priority.badge}</span> : null}
              </div>
              <p className="mt-2 text-sm text-slate-700">{priority.detail}</p>
              <Link href={priority.href} className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                {priority.label}
              </Link>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white/88 p-4" aria-label="Needs Attention">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">Needs Attention</h3>
                {attention.badge ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">{attention.badge}</span> : null}
              </div>
              <p className="mt-2 text-sm text-slate-700">{attention.detail}</p>
              <Link href={attention.href} className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                {attention.label}
              </Link>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/88 p-4" aria-label="Since Last Visit">
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Since Last Visit</h3>
            {sinceLastVisit.length === 0 ? (
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <p>No meaningful changes since your last visit.</p>
                <p>PostMotive will summarize new drafts, approvals, publishing activity, and integration updates here.</p>
              </div>
            ) : (
              <ol className="mt-3 space-y-2">
                {sinceLastVisit.slice(0, 4).map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4" aria-label="AI Guidance">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">AI Guidance</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{guidance.recommendation}</p>
            <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Why this matters:</span> {guidance.reason}</p>
            <Link href={guidance.href} className="mt-3 inline-flex rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">
              {guidance.cta}
            </Link>
          </section>
        </div>
      )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/90 to-transparent" />
      </div>
      </div>
    </section>
  );
}
