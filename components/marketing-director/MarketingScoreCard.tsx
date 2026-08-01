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
}) {
  const trendLabel = !props.trend.available
    ? "Not enough history yet"
    : props.trend.direction === "up"
      ? `+${props.trend.delta.toFixed(1)} since prior snapshot`
      : props.trend.direction === "down"
        ? `${props.trend.delta.toFixed(1)} since prior snapshot`
        : "No change since prior snapshot";

  return (
    <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Marketing Score</p>
          <p className={`mt-2 text-5xl font-black tracking-[-0.04em] ${statusTone[props.score.status]}`}>
            {props.score.score.toFixed(1)}
            <span className="ml-2 text-xl text-slate-500">/ {props.score.maximumScore}</span>
          </p>
          <p className="mt-2 text-sm text-slate-600">{props.score.confidenceReason}</p>
        </div>
        <p className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
          {trendLabel}
        </p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {props.score.categories.map((category) => (
          <article key={category.key} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{category.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {category.score.toFixed(1)}
              <span className="text-sm text-slate-500"> / {category.maximumScore}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">{category.status.replaceAll("_", " ")}</p>
            <p className="mt-2 text-sm text-slate-600">{category.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
