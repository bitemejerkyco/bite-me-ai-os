import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { MegaphoneIcon } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Campaigns – Bite Me AI OS" };

export default function CampaignsPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Campaigns"
        description="Create and manage your marketing campaigns."
        actions={
          <Link
            href="/campaigns/new"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            New campaign
          </Link>
        }
      />
      <EmptyState
        icon={<MegaphoneIcon className="h-6 w-6" />}
        title="No campaigns yet"
        description="Create your first campaign to start reaching your audience."
        action={
          <Link
            href="/campaigns/new"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Create campaign
          </Link>
        }
      />
    </div>
  );
}
