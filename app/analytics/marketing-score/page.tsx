import AppShell from "@/components/AppShell";
import MetricDetailPanel from "@/components/marketing-director/MetricDetailPanel";
import { buildMetricDrilldown } from "@/features/marketing-director/drilldowns";
import { loadMarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export default async function MarketingScoreDetailPage() {
  const context = await requireWorkspaceContext();
  const dashboard = await loadMarketingDirectorDashboard({
    workspaceId: context.workspaceId,
    firstName: context.firstName,
    workspaceName: context.workspaceName,
  });
  const detail = buildMetricDrilldown(dashboard, "marketing_score");

  return (
    <AppShell title="Marketing Score" eyebrow="Analytics drilldown">
      <MetricDetailPanel detail={detail} />
    </AppShell>
  );
}
