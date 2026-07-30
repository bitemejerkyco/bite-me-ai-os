import Sidebar from "@/components/Sidebar";
import AmazonAdsIntegrationSettings from "@/components/integrations/AmazonAdsIntegrationSettings";
export default function AmazonAdsIntegrationSettingsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 md:flex-row">
      <Sidebar />
      <div className="flex-1">
        <AmazonAdsIntegrationSettings initialView={null} initialError={null} />
      </div>
    </div>
  );
}
