"use client";

export type AgentState = "queued" | "working" | "complete";

export type AgentProgressItem = {
  key: string;
  name: string;
  role: string;
  state: AgentState;
};

export default function AgentProgress({ agents }: { agents: AgentProgressItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {agents.map((agent) => (
        <div key={agent.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{agent.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{agent.role}</p>
            </div>
            <span className={`size-2.5 rounded-full ${agent.state === "complete" ? "bg-emerald-400" : agent.state === "working" ? "animate-pulse bg-amber-400" : "bg-zinc-700"}`} />
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className={`h-full rounded-full transition-all duration-700 ${agent.state === "complete" ? "w-full bg-emerald-400" : agent.state === "working" ? "w-2/3 animate-pulse bg-red-500" : "w-0"}`} />
          </div>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-zinc-600">{agent.state}</p>
        </div>
      ))}
    </div>
  );
}
