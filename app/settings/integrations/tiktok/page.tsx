import Sidebar from "@/components/Sidebar";
import TikTokIntegrationSettings from "@/components/integrations/TikTokIntegrationSettings";
import { resolveTikTokActor } from "@/app/api/integrations/tiktok/_lib";
import { TikTokConnectionService } from "@/features/integrations/tiktok/service";
import type { TikTokConnectionView } from "@/features/integrations/tiktok/types";

type PageProps = {
  searchParams: Promise<{
    result?: string;
    message?: string;
  }>;
};

export default async function TikTokIntegrationSettingsPage({
  searchParams,
}: PageProps) {
  const parameters = await searchParams;
  let initialMessage =
    parameters.result === "connected"
      ? "TikTok sandbox account connected successfully."
      : parameters.result === "error"
        ? parameters.message || "TikTok authorization was not completed."
        : null;
  let initialView: TikTokConnectionView | null = null;
  try {
    const actor = await resolveTikTokActor();
    initialView = await new TikTokConnectionService().getStatus(actor);
    initialMessage ||= initialView.message;
  } catch (error) {
    initialMessage ||=
      error instanceof Error ? error.message : "Unable to load TikTok status.";
  }
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 md:flex-row">
      <Sidebar />
      <div className="flex-1">
        <TikTokIntegrationSettings
          initialView={initialView}
          initialMessage={initialMessage}
        />
      </div>
    </div>
  );
}
