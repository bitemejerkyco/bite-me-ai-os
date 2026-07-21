import { CalendarIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

export function UpcomingPosts() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Upcoming Posts</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Scheduled content for the next 7 days</p>
        </div>
        <Link
          href="/marketing-calendar"
          className="text-xs text-red-400 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
        >
          View calendar →
        </Link>
      </div>

      <div className="mt-4">
        <EmptyState
          icon={<CalendarIcon className="h-5 w-5" />}
          title="No posts scheduled"
          description="Create content and schedule it from the Content Studio."
          action={
            <Link
              href="/content-studio"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Create content
            </Link>
          }
        />
      </div>
    </div>
  );
}
