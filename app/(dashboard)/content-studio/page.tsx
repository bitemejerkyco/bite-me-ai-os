import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Content Studio – Bite Me AI OS" };

export default function ContentStudioPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Content Studio"
        description="Generate and manage AI-powered marketing content."
        actions={
          <Link
            href="/content-studio/new"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Generate content
          </Link>
        }
      />
      <EmptyState
        icon={<FileTextIcon className="h-6 w-6" />}
        title="No content created yet"
        description="Use the AI engine to generate blogs, social posts, ads, and more."
        action={
          <Link
            href="/content-studio/new"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Generate content
          </Link>
        }
      />
    </div>
  );
}
