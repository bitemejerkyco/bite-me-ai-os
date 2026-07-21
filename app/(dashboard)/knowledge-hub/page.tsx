import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Knowledge Hub – Bite Me AI OS" };

export default function KnowledgeHubPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Knowledge Hub"
        description="Upload documents and train your AI on your brand knowledge."
        actions={
          <Link
            href="/knowledge-hub/upload"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Upload documents
          </Link>
        }
      />
      <EmptyState
        icon={<BookOpenIcon className="h-6 w-6" />}
        title="No documents uploaded"
        description="Upload PDFs, Word docs, or paste text to build your AI knowledge base."
        action={
          <Link
            href="/knowledge-hub/upload"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Upload documents
          </Link>
        }
      />
    </div>
  );
}
