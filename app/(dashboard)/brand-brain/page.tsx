import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BrainIcon } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Brand Brain – Bite Me AI OS" };

export default function BrandBrainPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Brand Brain"
        description="Your AI-powered brand identity and voice engine."
        actions={
          <Link
            href="/brand-setup"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Set up brand
          </Link>
        }
      />
      <EmptyState
        icon={<BrainIcon className="h-6 w-6" />}
        title="No brand configured"
        description="Set up your brand to unlock AI-powered content generation."
        action={
          <Link
            href="/brand-setup"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Start brand setup
          </Link>
        }
      />
    </div>
  );
}
