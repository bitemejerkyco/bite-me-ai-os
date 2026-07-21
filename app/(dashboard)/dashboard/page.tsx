import { PageHeader } from "@/components/ui/PageHeader";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import { PlatformHealth } from "@/components/dashboard/PlatformHealth";
import { EnvironmentStatus } from "@/components/dashboard/EnvironmentStatus";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { UpcomingPosts } from "@/components/dashboard/UpcomingPosts";
import { CampaignPipeline } from "@/components/dashboard/CampaignPipeline";
import { BrandStatus } from "@/components/dashboard/BrandStatus";
import { KnowledgeBaseWidget } from "@/components/dashboard/KnowledgeBaseWidget";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { AIStatus } from "@/components/dashboard/AIStatus";

export const metadata = {
  title: "Mission Control – Bite Me AI OS",
};

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-7xl">
      <PageHeader
        title="Mission Control"
        description="Your AI-powered marketing command center."
      />

      {/* Top row: Getting Started + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GettingStarted />
        </div>
        <QuickActions />
      </div>

      {/* Status row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <PlatformHealth />
        <EnvironmentStatus />
        <AIStatus />
      </div>

      {/* Activity row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivity />
        <UpcomingPosts />
      </div>

      {/* Pipeline row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CampaignPipeline />
        </div>
        <div className="space-y-6">
          <BrandStatus />
          <KnowledgeBaseWidget />
        </div>
      </div>
    </div>
  );
}
