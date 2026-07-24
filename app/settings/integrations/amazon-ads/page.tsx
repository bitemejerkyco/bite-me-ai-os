import Sidebar from "@/components/Sidebar";
import AmazonAdsIntegrationSettings from "@/components/integrations/AmazonAdsIntegrationSettings";
import { AmazonAdsLiveConnectionService } from "@/features/marketing/providers/amazon-ads/live/connection-service";
import type { AmazonAdsConnectionView } from "@/features/marketing/providers/amazon-ads/live/types";

const DEFAULT_WORKSPACE_ID = "workspace-sandbox-01";
const DEFAULT_USER_ID = "user-demo";

async function loadInitialStatus(): Promise<{
  initialView: AmazonAdsConnectionView | null;
  initialError: string | null;
}> {
  try {
    const service = new AmazonAdsLiveConnectionService();
    const initialView = await service.getConnectionView({
      workspaceId: DEFAULT_WORKSPACE_ID,
      userId: DEFAULT_USER_ID,
    });
    return { initialView, initialError: null };
  } catch (error) {
    const initialError = error instanceof Error ? error.message : String(error);
    return {
      initialView: null,
      initialError,
    };
  }
}

export default async function AmazonAdsIntegrationSettingsPage() {
  const { initialView, initialError } = await loadInitialStatus();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 md:flex-row">
      <Sidebar />
      <div className="flex-1">
        <AmazonAdsIntegrationSettings initialView={initialView} initialError={initialError} />
      </div>
    </div>
  );
}
