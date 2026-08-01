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
import type { MarketingDirectorDashboard } from "@/features/marketing-director/dashboard";

const modeLabel: Record<MarketingDirectorDashboard["modeSettings"]["operatingMode"], string> = {
  advisor: "Advisor",
  copilot: "Copilot",
  autopilot: "Autopilot",
};

export default function MarketingDirectorDashboardView({
  dashboard,
}: {
  dashboard: MarketingDirectorDashboard;
}) {
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

      <CommandCenter modeLabel={modeLabel[dashboard.modeSettings.operatingMode]} />

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
