import type { ChannelHealthItem } from "@/features/marketing-director/dashboard";

const tone: Record<ChannelHealthItem["health"], string> = {
  healthy: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
  limited: "border-amber-200 bg-amber-50/70 text-amber-800",
  missing: "border-slate-200 bg-slate-100 text-slate-700",
  stale: "border-rose-200 bg-rose-50/80 text-rose-700",
};

export default function ChannelHealth({ channels }: { channels: ChannelHealthItem[] }) {
  return (
    <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Channel Health</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {channels.map((channel) => (
          <article key={channel.key} className={`rounded-2xl border p-4 ${tone[channel.health]}`}>
            <p className="text-sm font-semibold">{channel.label}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em]">{channel.health.replaceAll("_", " ")}</p>
            <p className="mt-2 text-sm">{channel.message}</p>
            {channel.lastSyncedAt ? (
              <p className="mt-2 text-xs">Synced {new Date(channel.lastSyncedAt).toLocaleString()}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
