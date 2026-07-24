import type { TrendPoint } from "@/features/marketing/providers/amazon-ads/insights/types";

type TrendMiniChartProps = {
  data: TrendPoint[];
};

export default function TrendMiniChart({ data }: TrendMiniChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-zinc-900/80 p-6 text-sm text-zinc-300">
        No trend data available for the selected filters.
      </div>
    );
  }

  const maxY = Math.max(...data.map((d) => Math.max(d.spend, d.sales)), 1);
  const width = 720;
  const height = 200;
  const padding = 20;

  const points = data.map((row, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
    const spendY = height - padding - (row.spend / maxY) * (height - padding * 2);
    const salesY = height - padding - (row.sales / maxY) * (height - padding * 2);
    return { x, spendY, salesY, date: row.date };
  });

  const spendPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.spendY}`).join(" ");
  const salesPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.salesY}`).join(" ");

  return (
    <div className="rounded-xl border border-red-500/30 bg-zinc-900/80 p-4">
      <p className="mb-3 text-sm font-medium text-zinc-200">Spend vs Sales Trend</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Spend vs Sales Trend">
        <path d={spendPath} fill="none" stroke="#f59e0b" strokeWidth="3" />
        <path d={salesPath} fill="none" stroke="#ef4444" strokeWidth="3" />
        {points.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.spendY} r="3" fill="#f59e0b" />
            <circle cx={point.x} cy={point.salesY} r="3" fill="#ef4444" />
          </g>
        ))}
      </svg>
      <div className="mt-3 flex gap-4 text-xs text-zinc-300">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />Spend</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" />Sales</span>
      </div>
    </div>
  );
}
