import Sidebar from "@/components/Sidebar";
import AmazonAdsInsightsDashboard from "@/components/analytics/AmazonAdsInsightsDashboard";
import { getAmazonAdsInsightsDashboard } from "@/features/marketing/providers/amazon-ads/insights/service";

export default async function AmazonAdsInsightsPage() {
  const model = await getAmazonAdsInsightsDashboard();

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 md:flex-row">
      <Sidebar />
      <div className="flex-1">
        <AmazonAdsInsightsDashboard model={model} />
      </div>
    </div>
  );
}
