import type { ReactNode } from "react";

type MetricCardProps = {
  eyebrow: string;
  title: string;
  value: string;
  detail?: string;
  tone?: "default" | "warning" | "critical";
  footer?: ReactNode;
};

const toneStyles: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "border-white/90 bg-white/75",
  warning: "border-amber-200 bg-amber-50/80",
  critical: "border-rose-200 bg-rose-50/85",
};

export default function MetricCard({
  eyebrow,
  title,
  value,
  detail,
  tone = "default",
  footer,
}: MetricCardProps) {
  return (
    <article className={`pm-glass rounded-[2rem] border p-5 ${toneStyles[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-violet-600">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-3 text-4xl font-black tracking-[-0.04em] text-slate-900">
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
      ) : null}
      {footer ? <div className="mt-4 text-xs text-slate-500">{footer}</div> : null}
    </article>
  );
}