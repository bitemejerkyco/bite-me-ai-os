import Link from "next/link";
import { BookOpenIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export function KnowledgeBaseWidget() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Knowledge Base</h2>
        <Link href="/knowledge-hub" className="text-xs text-red-400 hover:text-red-300 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
          View →
        </Link>
      </div>

      <div className="mt-3">
        <EmptyState
          icon={<BookOpenIcon className="h-5 w-5" />}
          title="No documents"
          description="Upload brand docs to train your AI."
          action={
            <Link
              href="/knowledge-hub"
              className="rounded-lg border border-[#333] px-3 py-1.5 text-xs text-zinc-400 hover:border-[#444] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Upload documents
            </Link>
          }
        />
      </div>
    </div>
  );
}
