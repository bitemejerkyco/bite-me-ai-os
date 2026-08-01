import Link from "next/link";
import { destinationForScoreCategory } from "@/features/marketing-director/score-category-routes";
import { formatTrendIndicator } from "@/features/marketing-director/trends";
import type { MarketingScoreResult, MarketingScoreTrend } from "@/features/marketing-director/marketing-score-rules";

const statusTone: Record<MarketingScoreResult["status"], string> = {
  excellent: "text-emerald-700",
  healthy: "text-emerald-700",
  needs_attention: "text-amber-700",
  critical: "text-rose-700",
  unavailable: "text-slate-600",
};

export default function MarketingScoreCard(props: {
  score: MarketingScoreResult;
  trend: MarketingScoreTrend;
  collapsible?: boolean;
}) {
  const trendLabel = formatTrendIndicator(props.trend);

  const categoryGrid = (
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {props.score.categories.map((category) => (
        <Link
          key={category.key}
          href={destinationForScoreCategory(category.key)}
          className="group rounded-2xl border border-slate-200 bg-white/80 p-4 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(76,61,139,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{category.label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {category.score.toFixed(1)}
            <span className="text-sm text-slate-500"> / {category.maximumScore}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">{category.status.replaceAll("_", " ")}</p>
          <p className="mt-2 text-sm text-slate-600">{category.explanation}</p>
          <p className="mt-2 text-xs font-semibold text-violet-700 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            Open category
          </p>
        </Link>
      ))}
    </div>
  );

  return (
    <section data-help="dashboard-score" className="pm-glass-premium rounded-[2rem] border border-white/90 bg-white/80 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Marketing Score</p>
          <p className={`pm-number-pop mt-2 text-5xl font-black tracking-[-0.04em] ${statusTone[props.score.status]}`}>
            {props.score.score.toFixed(1)}
            <span className="ml-2 text-xl text-slate-500">/ {props.score.maximumScore}</span>
          </p>
          <p className="mt-2 text-sm text-slate-600">{props.score.confidenceReason}</p>
          <div className="mt-3 pm-sparkline max-w-xs" aria-hidden="true" />
        </div>
        {trendLabel ? (
          <p className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
            {trendLabel}
          </p>
        ) : (
          <p className="text-xs font-semibold text-slate-500">Baseline snapshot will appear after more activity is recorded.</p>
        )}
      </div>

      {props.collapsible ? (
        <details className="mt-4 rounded-2xl border border-slate-200 bg-white/65 p-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
            Marketing Score category breakdown
          </summary>
          <p className="mt-2 text-xs text-slate-500">
            Detailed category breakdown is collapsed by default to keep the dashboard concise.
            <Link href="/analytics/marketing-score" className="ml-1 font-semibold text-violet-700 hover:text-violet-600">
              Open full score page
            </Link>
          </p>
          {categoryGrid}
        </details>
      ) : (
        categoryGrid
      )}
    </section>
  );
}
