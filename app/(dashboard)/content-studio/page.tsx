import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileTextIcon } from "lucide-react";

export const metadata = { title: "Content Studio – Bite Me AI OS" };

export default function ContentStudioPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Content Studio"
        description="Generate and manage AI-powered marketing content."
      />
      <EmptyState
        icon={<FileTextIcon className="h-6 w-6" />}
        title="No content created yet"
        description="AI content generation is coming soon."
      />
    </div>
  );
}
