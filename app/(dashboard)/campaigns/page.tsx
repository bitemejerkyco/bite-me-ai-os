import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { MegaphoneIcon } from "lucide-react";

export const metadata = { title: "Campaigns – Bite Me AI OS" };

export default function CampaignsPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Campaigns"
        description="Create and manage your marketing campaigns."
      />
      <EmptyState
        icon={<MegaphoneIcon className="h-6 w-6" />}
        title="No campaigns yet"
        description="Campaign creation is coming soon."
      />
    </div>
  );
}
