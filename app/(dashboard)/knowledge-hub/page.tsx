import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpenIcon } from "lucide-react";

export const metadata = { title: "Knowledge Hub – Bite Me AI OS" };

export default function KnowledgeHubPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Knowledge Hub"
        description="Upload documents and train your AI on your brand knowledge."
      />
      <EmptyState
        icon={<BookOpenIcon className="h-6 w-6" />}
        title="No documents uploaded"
        description="Document upload is coming soon."
      />
    </div>
  );
}
