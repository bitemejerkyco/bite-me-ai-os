import Link from "next/link";
import type { DataCoverageModel } from "@/features/marketing-director/data-coverage";

export default function DataCoverageNotice({ coverage }: { coverage: DataCoverageModel }) {
  const connected = coverage.sources.filter((source) => source.health === "healthy");
  const missing = coverage.sources.filter((source) => source.health === "missing" || source.health === "limited");
  const confidencePercent = Math.round(coverage.overallConfidence * 100);
  const tone = coverage.warning
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : "border-emerald-200 bg-emerald-50/70 text-emerald-900";

  return (
    <section className={`rounded-3xl border p-4 md:p-5 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em]">Data coverage</p>
          <p className="mt-1 text-sm font-semibold">
            {confidencePercent}% confidence from connected workspace sources
          </p>
          <p className="mt-1 text-sm opacity-90">
            {coverage.warning || "Coverage is healthy. Recommendations are based on connected data."}
          </p>
        </div>
        <Link
          href="/integrations"
          className="inline-flex rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-white"
        >
          Manage integrations
        </Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-white/80 bg-white/70 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Connected sources</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {connected.length === 0 ? (
              <li>No healthy sources connected yet.</li>
            ) : (
              connected.slice(0, 5).map((source) => <li key={source.key}>{source.label}</li>)
            )}
          </ul>
        </article>
        <article className="rounded-2xl border border-white/80 bg-white/70 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Missing or limited</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {missing.length === 0 ? (
              <li>All tracked sources are currently healthy.</li>
            ) : (
              missing.slice(0, 5).map((source) => (
                <li key={source.key}>{source.label}: {source.message}</li>
              ))
            )}
          </ul>
        </article>
      </div>
    </section>
  );
}
