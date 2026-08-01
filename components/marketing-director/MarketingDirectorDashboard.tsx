"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CommandCenter from "@/components/marketing-director/CommandCenter";
import AutonomousRecommendationCard from "@/components/marketing-director/AutonomousRecommendationCard";
import DirectorActivity from "@/components/marketing-director/DirectorActivity";
import DailyBriefPanel from "@/components/marketing-director/DailyBriefPanel";
import ChannelHealth from "@/components/marketing-director/ChannelHealth";
import DataCoverageNotice from "@/components/marketing-director/DataCoverageNotice";
import ExecutiveHeader from "@/components/marketing-director/ExecutiveHeader";
import MarketingScoreCard from "@/components/marketing-director/MarketingScoreCard";
import MetricCard from "@/components/marketing-director/MetricCard";
import PriorityActions from "@/components/marketing-director/PriorityActions";
import RecommendationCard from "@/components/marketing-director/RecommendationCard";
import { useHelp } from "@/components/help/HelpContext";
import type { MarketingDirectorDashboard } from "@/features/marketing-director/dashboard";

const modeLabel: Record<MarketingDirectorDashboard["modeSettings"]["operatingMode"], string> = {
  advisor: "Advisor",
  copilot: "Copilot",
  autopilot: "Autopilot",
};

export default function MarketingDirectorDashboardView({
  dashboard,
  canViewTechnicalDetails,
}: {
  dashboard: MarketingDirectorDashboard;
  canViewTechnicalDetails: boolean;
}) {
  const { walkthrough, setAssistantOpen } = useHelp();
  const connectedChannels = dashboard.channelHealth.filter((channel) => channel.connected).length;
  const productSource = dashboard.dataCoverage.sources.find((source) => source.key === "products") || null;

  const welcomeStorageKey = useMemo(() => `postmotive-welcome-state:${dashboard.workspaceName}`, [dashboard.workspaceName]);

  const [welcomeStateStorage, setWelcomeStateStorage] = useState<{ collapsed: boolean; dismissed: boolean }>(() => {
    if (typeof window === "undefined") {
      return { collapsed: false, dismissed: false };
    }
    try {
      const saved = window.localStorage.getItem(welcomeStorageKey);
      if (!saved) return { collapsed: false, dismissed: false };
      const parsed = JSON.parse(saved) as { collapsed?: boolean; dismissed?: boolean };
      return {
        collapsed: Boolean(parsed.collapsed),
        dismissed: Boolean(parsed.dismissed),
      };
    } catch {
      return { collapsed: false, dismissed: false };
    }
  });

  const welcomeCollapsed = welcomeStateStorage.collapsed;
  const welcomeDismissed = welcomeStateStorage.dismissed;

  function persistWelcomeState(next: { collapsed?: boolean; dismissed?: boolean }) {
    const value = {
      collapsed: next.collapsed ?? welcomeCollapsed,
      dismissed: next.dismissed ?? welcomeDismissed,
    };
    setWelcomeStateStorage({
      collapsed: Boolean(value.collapsed),
      dismissed: Boolean(value.dismissed),
    });
    window.localStorage.setItem(welcomeStorageKey, JSON.stringify(value));
  }

  const welcomeState = dashboard.dataCoverage.sources.some((source) => !source.configured)
    && connectedChannels < 2
    && (productSource?.recordCount || 0) === 0;

  return (
    <div className="space-y-5">
      <ExecutiveHeader
        greeting={dashboard.greeting}
        firstName={dashboard.firstName}
        workspaceName={dashboard.workspaceName}
        dateLabel={dashboard.dateLabel}
        mode={dashboard.modeSettings}
      />

      <DailyBriefPanel
        brief={dashboard.brief}
        greeting={dashboard.greeting}
        firstName={dashboard.firstName}
      />

      <section data-help="dashboard-ai-value-summary" className="rounded-[2rem] border border-slate-200 bg-white/90 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">AI value summary</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{dashboard.greeting}, {dashboard.firstName}.</h2>
        <p className="mt-2 text-sm text-slate-700">PostMotive found:</p>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          <li>{dashboard.approvalSummary?.pending || 0} draft{dashboard.approvalSummary?.pending === 1 ? "" : "s"} waiting for approval</li>
          <li>{dashboard.publishingQueue?.queued || 0} item{dashboard.publishingQueue?.queued === 1 ? "" : "s"} ready for the next scheduling step</li>
          <li>{connectedChannels} connected channel{connectedChannels === 1 ? "" : "s"}</li>
          <li>{dashboard.channelHealth.find((item) => item.key === "amazon_ads")?.connected ? "Amazon Ads connected" : "Amazon Ads not connected"}</li>
          <li>{(productSource?.recordCount || 0) > 0 ? `${productSource?.recordCount || 0} products available` : "Product catalog empty"}</li>
        </ul>
        <p className="mt-3 text-sm text-slate-800">
          <span className="font-semibold">Recommended first step:</span> {dashboard.brief.recommendedNextAction?.title || "Review the Executive Brief"}
        </p>
      </section>

      {welcomeState && !welcomeDismissed ? (
        <section data-help="dashboard-welcome" className="rounded-[2rem] border border-violet-200 bg-violet-50/80 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Welcome to PostMotive</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Your AI Marketing Director helps you move from setup to execution.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                Your AI Marketing Director helps you plan campaigns, create content, organize approvals, schedule publishing, and improve performance.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => persistWelcomeState({ collapsed: !welcomeCollapsed })} className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-700">
                {welcomeCollapsed ? "Expand" : "Collapse"}
              </button>
              <button type="button" onClick={() => persistWelcomeState({ dismissed: true })} className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-700">
                Dismiss
              </button>
            </div>
          </div>

          {!welcomeCollapsed ? (
            <>
              <div className="mt-4 rounded-2xl border border-violet-200 bg-white/90 p-4">
                <p className="text-sm font-semibold text-slate-900">Recommended setup:</p>
                <ol className="mt-2 space-y-1 text-sm text-slate-700">
                  <li>1. Complete your business profile</li>
                  <li>2. Upload your logo and brand assets</li>
                  <li>3. Add products or services</li>
                  <li>4. Connect your first marketing channel</li>
                  <li>5. Generate your first marketing plan</li>
                </ol>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/onboarding" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                  Start Setup
                </Link>
                <button type="button" onClick={() => void walkthrough.start("dashboard-overview")} className="rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">
                  Take a 2-Minute Tour
                </button>
                <button type="button" onClick={() => setAssistantOpen(true)} className="rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">
                  Ask PostMotive
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-700">Continue setup from the onboarding checklist or reopen this panel any time.</p>
          )}
        </section>
      ) : null}

      <div data-help="dashboard-command-center">
        <CommandCenter modeLabel={modeLabel[dashboard.modeSettings.operatingMode]} canViewTechnicalDetails={canViewTechnicalDetails} />
      </div>

      <DirectorActivity />

      <DataCoverageNotice coverage={dashboard.dataCoverage} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.cards.map((card) => (
          <MetricCard key={card.id} card={card} />
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Biggest opportunity</p>
          <p className="mt-2 text-sm font-semibold text-emerald-900">{dashboard.biggestOpportunity || "No opportunity summary available yet."}</p>
        </article>
        <article className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">Biggest risk</p>
          <p className="mt-2 text-sm font-semibold text-rose-900">{dashboard.biggestRisk || "No critical risk summary available yet."}</p>
        </article>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Autonomy level</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{dashboard.autonomyLevel || 3}</p>
          <p className="mt-1 text-xs text-slate-600">Policy-constrained autonomy (1-5)</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Approvals pending</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{dashboard.approvalSummary?.pending || 0}</p>
          <p className="mt-1 text-xs text-slate-600">Inbox items waiting for decision</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Publishing queue</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{dashboard.publishingQueue?.publishing || 0}</p>
          <p className="mt-1 text-xs text-slate-600">Currently in prepare/publish stages</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Notifications</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{dashboard.pendingNotifications || 0}</p>
          <p className="mt-1 text-xs text-slate-600">Pending in-app/email trigger messages</p>
        </article>
      </section>

      <PriorityActions actions={dashboard.brief.priorityActions} urgency={dashboard.brief.urgency} />

      <MarketingScoreCard score={dashboard.score} trend={dashboard.scoreTrend} collapsible />

      <ChannelHealth channels={dashboard.channelHealth} />

      <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">AI execution health</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acceptance rate</p>
            <p className="mt-2 text-lg font-black text-slate-900">{dashboard.aiHealth?.acceptanceRate || "0.0%"}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execution success</p>
            <p className="mt-2 text-lg font-black text-slate-900">{dashboard.aiHealth?.executionSuccessRate || "0.0%"}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publishing success</p>
            <p className="mt-2 text-lg font-black text-slate-900">{dashboard.aiHealth?.publishingSuccessRate || "0.0%"}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Forecast accuracy</p>
            <p className="mt-2 text-lg font-black text-slate-900">{dashboard.aiHealth?.forecastAccuracyRate || "0.0%"}</p>
          </article>
        </div>
      </section>

      <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Forecasting and capacity</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(dashboard.forecastSummary || []).length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-600">
              Forecast data will appear after the first execution and analytics collection cycle.
            </p>
          ) : (
            (dashboard.forecastSummary || []).map((forecast) => (
              <article key={`${forecast.type}-${forecast.note}`} className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{forecast.type.replaceAll("_", " ")}</p>
                <p className="mt-1 text-base font-bold text-slate-900">{forecast.label}</p>
                <p className="mt-1 text-xs text-slate-600">Confidence {(forecast.confidence * 100).toFixed(0)}%</p>
                <p className="mt-2 text-sm text-slate-700">{forecast.note}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">AI marketing departments</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(dashboard.departments || []).length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-600">
              Department status will appear as autonomous execution activity is collected.
            </p>
          ) : (
            (dashboard.departments || []).map((department) => (
              <article key={department.key} className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{department.label}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{department.status}</p>
                <p className="mt-1 text-sm text-slate-700">{department.summary}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Execution timeline</p>
        <div className="mt-4 space-y-2">
          {(dashboard.timeline || []).length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-600">
              Timeline events will appear as workflows run and approvals are processed.
            </p>
          ) : (
            (dashboard.timeline || []).map((event) => (
              <article key={event.id} className="rounded-xl border border-slate-200 bg-white/85 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-wide">{event.type.replaceAll("_", " ")}</span>
                  <span>{new Date(event.timestamp).toLocaleString("en-US")}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{event.message}</p>
                <p className="mt-1 text-xs text-slate-600">Status: {event.status} • Actor: {event.actor}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Autonomous AI CMO recommendations</p>
        <p className="mt-2 text-sm text-slate-600">
          Recommendations are continuously ranked by ROI, confidence, and execution readiness while preserving approval workflow.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(dashboard.autonomousRecommendations || []).length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-600">
              Autonomous recommendations will appear as connected trend signals become available.
            </p>
          ) : (
            (dashboard.autonomousRecommendations || []).map((recommendation) => (
              <AutonomousRecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))
          )}
        </div>
      </section>

      <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Recommended next steps</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {dashboard.brief.recommendations.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-600">
              Recommendations will appear as more connected data becomes available.
            </p>
          ) : (
            dashboard.brief.recommendations.map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
