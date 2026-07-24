import { MegaphoneIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";

const stages = [
  { label: "Draft", count: 0 },
  { label: "Active", count: 0 },
  { label: "Paused", count: 0 },
  { label: "Completed", count: 0 },
];

export function CampaignPipeline() {
  const total = stages.reduce((s, st) => s + st.count, 0);

  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Campaign Pipeline</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Campaign status overview</p>
        </div>
        <Link href="/campaigns" className="text-xs text-red-400 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded">
          View all →
        </Link>
      </div>

      {total === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<MegaphoneIcon className="h-5 w-5" />}
            title="No campaigns yet"
            description="Create your first campaign to get started."
            action={
              <Link
                href="/campaigns"
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                New campaign
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-3">
          {stages.map((stage) => (
            <div key={stage.label} className="rounded-lg bg-[#1e1e1e] p-3 text-center">
              <p className="text-xl font-semibold text-white">{stage.count}</p>
              <StatusBadge
                label={stage.label}
                variant={
                  stage.label === "Active"
                    ? "active"
                    : stage.label === "Paused"
                    ? "warning"
                    : stage.label === "Completed"
                    ? "success"
                    : "inactive"
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
