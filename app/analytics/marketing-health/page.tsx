import AppShell from "@/components/AppShell";
import MetricDetailPanel from "@/components/marketing-director/MetricDetailPanel";
import { buildMetricDrilldown } from "@/features/marketing-director/drilldowns";
import { loadMarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export default async function MarketingHealthDetailPage() {
  const context = await requireWorkspaceContext();
  const dashboard = await loadMarketingDirectorDashboard({
    workspaceId: context.workspaceId,
    firstName: context.firstName,
    workspaceName: context.workspaceName,
  });
  const detail = buildMetricDrilldown(dashboard, "marketing_health");

  return (
    <AppShell title="Marketing Health" eyebrow="Analytics drilldown">
      <MetricDetailPanel detail={detail} />
    </AppShell>
  );
}
