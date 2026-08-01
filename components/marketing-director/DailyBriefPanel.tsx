import type { DailyBrief } from "@/features/marketing-director/daily-brief-rules";

export default function DailyBriefPanel({ brief }: { brief: DailyBrief }) {
  return (
    <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Daily Brief</p>
      <p className="mt-2 text-sm text-slate-600">Generated {new Date(brief.generatedAt).toLocaleString()}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Since last visit</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {brief.sinceLastVisit.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Needs attention</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {brief.needsAttention.length === 0 ? <li>Nothing urgent right now.</li> : brief.needsAttention.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </article>
      </div>
    </section>
  );
}
