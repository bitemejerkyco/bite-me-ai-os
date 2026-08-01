import CommandCenter from "@/components/marketing-director/CommandCenter";
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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.cards.map((card) => (
          <MetricCard key={card.id} card={card} />
        ))}
      </section>

      <CommandCenter modeLabel={modeLabel[dashboard.modeSettings.operatingMode]} />

      <PriorityActions actions={dashboard.brief.priorityActions} urgency={dashboard.brief.urgency} />

      <DataCoverageNotice coverage={dashboard.dataCoverage} />

      <MarketingScoreCard score={dashboard.score} trend={dashboard.scoreTrend} collapsible />

      <ChannelHealth channels={dashboard.channelHealth} />

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
