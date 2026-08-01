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

      <PriorityActions actions={dashboard.brief.priorityActions} urgency={dashboard.brief.urgency} />

      <MarketingScoreCard score={dashboard.score} trend={dashboard.scoreTrend} collapsible />

      <ChannelHealth channels={dashboard.channelHealth} />

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
