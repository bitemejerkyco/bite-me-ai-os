import type { ExecutiveMetricCard } from "@/features/marketing-director/dashboard";

const statusClass: Record<ExecutiveMetricCard["status"], string> = {
  healthy: "border-emerald-200 bg-emerald-50/70",
  warning: "border-amber-200 bg-amber-50/80",
  critical: "border-rose-200 bg-rose-50/85",
  unavailable: "border-slate-200 bg-slate-100/90",
};

export default function MetricCard({ card }: { card: ExecutiveMetricCard }) {
  return (
    <article className={`rounded-[1.6rem] border p-5 ${statusClass[card.status]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{card.label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{card.value}</p>
      <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
      {card.trendLabel ? <p className="mt-3 text-xs font-semibold text-slate-500">{card.trendLabel}</p> : null}
    </article>
  );
}
