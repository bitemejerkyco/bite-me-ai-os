import Link from "next/link";
import { BrainIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function BrandStatus() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Brand Status</h2>
        <Link href="/brand-brain" className="text-xs text-red-400 hover:text-red-300 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
          Manage →
        </Link>
      </div>

      <div className="mt-4 flex flex-col items-center justify-center rounded-lg bg-[#1e1e1e] p-6">
        <BrainIcon className="h-8 w-8 text-zinc-700" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-zinc-400">No brand configured</p>
        <StatusBadge label="Setup required" variant="warning" />
        <Link
          href="/brand-setup"
          className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Set up brand
        </Link>
      </div>
    </div>
  );
}
