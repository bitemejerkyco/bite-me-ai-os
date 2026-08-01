import AppShell from "@/components/AppShell";
import MarketingDirectorDashboardView from "@/components/marketing-director/MarketingDirectorDashboard";
import { loadMarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import type { MarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import { redirect } from "next/navigation";

function mapHomeErrorToRedirect(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.startsWith("AUTH_REQUIRED:")) return "/login";
  if (message.startsWith("WORKSPACE_REQUIRED:")) return "/onboarding";
  return null;
}

export default async function Home() {
  let dashboard: MarketingDirectorDashboard;
  try {
    const context = await requireWorkspaceContext();
    dashboard = await loadMarketingDirectorDashboard({
      workspaceId: context.workspaceId,
      firstName: context.firstName,
      workspaceName: context.workspaceName,
    });
  } catch (error) {
    const destination = mapHomeErrorToRedirect(error);
    if (destination) {
      redirect(destination);
    }
    throw error;
  }

  return (
    <AppShell title="AI Marketing Director" eyebrow="PostMotive">
      <MarketingDirectorDashboardView dashboard={dashboard} />
    </AppShell>
  );
}
