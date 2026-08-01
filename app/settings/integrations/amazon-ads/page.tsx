import Sidebar from "@/components/Sidebar";
import PageHelpPanel from "@/components/help/PageHelpPanel";
import AmazonAdsIntegrationSettings from "@/components/integrations/AmazonAdsIntegrationSettings";
export default function AmazonAdsIntegrationSettingsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 md:flex-row">
      <Sidebar />
      <div className="flex-1">
        <div className="px-5 pt-5 md:px-10">
          <PageHelpPanel />
        </div>
        <AmazonAdsIntegrationSettings initialView={null} initialError={null} />
      </div>
    </div>
  );
}
