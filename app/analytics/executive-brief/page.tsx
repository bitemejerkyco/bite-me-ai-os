import AppShell from "@/components/AppShell";
import DailyBriefPanel from "@/components/marketing-director/DailyBriefPanel";
import { loadMarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export default async function ExecutiveBriefPage() {
  const context = await requireWorkspaceContext();
  const dashboard = await loadMarketingDirectorDashboard({
    workspaceId: context.workspaceId,
    firstName: context.firstName,
    workspaceName: context.workspaceName,
  });

  return (
    <AppShell title="Daily Executive Brief" eyebrow="Marketing director">
      <DailyBriefPanel brief={dashboard.brief} />
    </AppShell>
  );
}
