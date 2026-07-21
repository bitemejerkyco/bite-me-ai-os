import { BotIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";

const agents = [
  { name: "Content Writer", status: "inactive" as const },
  { name: "Social Media Manager", status: "inactive" as const },
  { name: "SEO Analyst", status: "inactive" as const },
];

export function AIStatus() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">AI Status</h2>
        <Link href="/ai-employees" className="text-xs text-red-400 hover:text-red-300 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
          Manage →
        </Link>
      </div>
      <p className="mt-0.5 text-xs text-zinc-500">AI employee availability</p>

      <ul className="mt-4 space-y-3">
        {agents.map((agent) => (
          <li key={agent.name} className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1e1e1e]">
              <BotIcon className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
            </span>
            <span className="flex-1 text-sm text-zinc-300">{agent.name}</span>
            <StatusBadge label="Inactive" variant={agent.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
