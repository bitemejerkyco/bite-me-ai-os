import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart2Icon } from "lucide-react";

export const metadata = { title: "Analytics – Bite Me AI OS" };

export default function AnalyticsPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Analytics"
        description="Track performance across campaigns, content, and channels."
      />
      <EmptyState
        icon={<BarChart2Icon className="h-6 w-6" />}
        title="No data yet"
        description="Connect your channels and run campaigns to start seeing analytics."
      />
    </div>
  );
}
