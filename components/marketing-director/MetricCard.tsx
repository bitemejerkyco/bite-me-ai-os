import { memo } from "react";
import Link from "next/link";
import type { ExecutiveMetricCard } from "@/features/marketing-director/dashboard";

const statusClass: Record<ExecutiveMetricCard["status"], string> = {
  healthy: "border-emerald-200 bg-emerald-50/70",
  warning: "border-amber-200 bg-amber-50/80",
  critical: "border-rose-200 bg-rose-50/85",
  unavailable: "border-slate-200 bg-slate-100/90",
};

const statusDotClass: Record<ExecutiveMetricCard["status"], string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  unavailable: "bg-slate-400",
};

function trendArrow(direction: ExecutiveMetricCard["trendDirection"]): string {
  if (direction === "up") return "↗";
  if (direction === "down") return "↘";
  return "→";
}

function MetricCard({ card }: { card: ExecutiveMetricCard }) {
  return (
    <Link
      href={card.href}
      aria-label={`Open ${card.label} details`}
      className={`pm-lift group block rounded-[1.6rem] border p-4 transition duration-200 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${statusClass[card.status]}`}
    >
      <article>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
          <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass[card.status]}`} aria-hidden="true" />
        </div>
        <p className="pm-number-pop mt-2 text-3xl font-black tracking-tight text-slate-900">{card.value}</p>
        <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
        {card.aiExplanation ? <p className="mt-2 text-xs text-slate-600">AI: {card.aiExplanation}</p> : null}
        {card.recommendedAction ? <p className="mt-1 text-xs font-semibold text-slate-700">Recommended action: {card.recommendedAction}</p> : null}
        {typeof card.confidence === "number" ? <p className="mt-1 text-xs text-slate-500">Confidence: {Math.round(card.confidence * 100)}%</p> : null}
        <div className="mt-3 pm-sparkline" aria-hidden="true" />
        {card.trendLabel ? <p className="mt-2 text-xs font-semibold text-slate-500">{trendArrow(card.trendDirection)} {card.trendLabel}</p> : null}
        <p className="mt-3 text-xs font-semibold text-violet-700 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          View details
        </p>
      </article>
    </Link>
  );
}

export default memo(MetricCard);
