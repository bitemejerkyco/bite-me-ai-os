import Link from "next/link";
import type { MarketingRecommendation } from "@/features/marketing-director/daily-brief-rules";

export default function RecommendationCard({ recommendation }: { recommendation: MarketingRecommendation }) {
  return (
    <article className="rounded-3xl border border-slate-200/90 bg-white/85 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-900">{recommendation.title}</h3>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          {recommendation.expectedImpact}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{recommendation.summary}</p>
      <p className="mt-2 text-sm text-slate-600">{recommendation.reason}</p>
      <p className="mt-2 text-xs text-slate-500">Confidence: {(recommendation.confidence * 100).toFixed(0)}%</p>
      <ul className="mt-3 space-y-1 text-xs text-slate-500">
        {recommendation.evidence.slice(0, 3).map((item) => (
          <li key={`${recommendation.id}-${item.label}`}>{item.label}: {item.value}</li>
        ))}
      </ul>
      <Link href={recommendation.actionHref} className="mt-3 inline-flex text-xs font-semibold text-violet-700 hover:text-violet-600">
        Review recommendation
      </Link>
    </article>
  );
}
