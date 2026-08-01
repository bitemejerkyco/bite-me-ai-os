import Link from "next/link";
import type { MetricDrilldown } from "@/features/marketing-director/drilldowns";

export default function MetricDetailPanel({ detail }: { detail: MetricDrilldown }) {
  return (
    <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Metric Detail</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{detail.title}</h1>
      <p className="mt-2 text-4xl font-black tracking-[-0.03em] text-slate-900">{detail.value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">{detail.explanation}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail.calculation}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Contributing data sources</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {detail.contributingSources.map((source) => (
              <li key={source.key}>{source.label}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Missing or incomplete data</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {detail.missingSources.length === 0 ? (
              <li>None identified.</li>
            ) : (
              detail.missingSources.map((source) => (
                <li key={source.key}>{source.label}: {source.message}</li>
              ))
            )}
          </ul>
        </article>
      </div>

      <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
        <p className="text-sm font-semibold text-violet-900">Next action</p>
        <p className="mt-1 text-sm text-violet-800">Use this action to improve this metric with real connected data.</p>
        <Link
          href={detail.nextAction.href}
          className="mt-3 inline-flex rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
        >
          {detail.nextAction.label}
        </Link>
      </div>
    </section>
  );
}
