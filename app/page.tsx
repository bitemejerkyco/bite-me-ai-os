import AppShell from "@/components/AppShell";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import MarketingDirectorDashboardView from "@/components/marketing-director/MarketingDirectorDashboard";
import { loadMarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import type { MarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import { getViewerContext } from "@/lib/auth/server";
import { redirect } from "next/navigation";

function mapHomeErrorToRedirect(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.startsWith("AUTH_REQUIRED:")) return "/login";
  return null;
}

function mapHomeErrorToFriendlyMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.startsWith("WORKSPACE_LOOKUP_FAILED:")) {
    return "We could not confirm your workspace yet. Finish setup and we will retry automatically.";
  }
  if (message.startsWith("WORKSPACE_BOOTSTRAP_FAILED:") || message.startsWith("WORKSPACE_MEMBERSHIP_BOOTSTRAP_FAILED:")) {
    return "We could not finish workspace setup automatically yet. You can continue setup now and come right back.";
  }
  if (message.startsWith("WORKSPACE_ACCESS_FAILED:")) {
    return "Your workspace exists but access is not ready yet. Continue setup so we can refresh permissions.";
  }
  return "We could not load your dashboard yet. Continue setup and retry in a moment.";
}

export default async function Home() {
  let dashboard: MarketingDirectorDashboard;
  const viewer = await getViewerContext();
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

    return (
      <AppShell title="AI Marketing Director" eyebrow="PostMotive">
        <GuidedEmptyState
          title="Finish Workspace Setup"
          description={mapHomeErrorToFriendlyMessage(error)}
          estimatedTime="3-5 minutes"
          whyItMatters="A workspace is required before we can compute your marketing score and dashboard insights."
          recommendedAction="Complete Business Setup to create your default workspace and grant owner access."
          primaryAction={{ label: "Open Business Setup", href: "/onboarding" }}
          secondaryAction={{ label: "Open Integrations", href: "/integrations" }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="AI Marketing Director" eyebrow="PostMotive">
      <MarketingDirectorDashboardView dashboard={dashboard} canViewTechnicalDetails={viewer.canViewTechnicalDetails} />
    </AppShell>
  );
}
