import Sidebar from "@/components/Sidebar";
import AmazonAdsIntegrationSettings from "@/components/integrations/AmazonAdsIntegrationSettings";
export default function AmazonAdsIntegrationSettingsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 md:flex-row">
      <Sidebar />
      <div className="flex-1">
        <AmazonAdsIntegrationSettings initialView={null} initialError={null} />
      </div>
    </div>
  );
}
