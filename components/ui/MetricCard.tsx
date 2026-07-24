import type { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: { label: string; positive: boolean };
}

export function MetricCard({ title, value, description, icon, trend }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-zinc-400">{title}</p>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e1e1e] text-zinc-400">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {(description || trend) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span
              className={`text-xs font-medium ${trend.positive ? "text-emerald-400" : "text-red-400"}`}
            >
              {trend.label}
            </span>
          )}
          {description && (
            <span className="text-xs text-zinc-500">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}
