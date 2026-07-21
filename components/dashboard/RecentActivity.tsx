import { ClockIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export function RecentActivity() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
      <p className="mt-0.5 text-xs text-zinc-500">Your latest actions and events</p>

      <div className="mt-4">
        <EmptyState
          icon={<ClockIcon className="h-5 w-5" />}
          title="No activity yet"
          description="Actions you and your AI employees take will appear here."
        />
      </div>
    </div>
  );
}
