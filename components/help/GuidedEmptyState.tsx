import Link from "next/link";

export default function GuidedEmptyState({
  title,
  description,
  estimatedTime,
  whyItMatters,
  recommendedAction,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  description: string;
  estimatedTime?: string;
  whyItMatters?: string;
  recommendedAction?: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}) {
  return (
    <div className="pm-glass-premium rounded-[1.8rem] border border-white/85 bg-white/80 p-6 text-left shadow-[0_16px_44px_rgba(44,53,86,0.1)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Guided next step</p>
          <p className="mt-2 text-xl font-black tracking-tight text-slate-900">{title}</p>
        </div>
        <div className="pm-empty-illustration" aria-hidden="true" />
      </div>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      <p className="mt-2 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Why this matters:</span>{" "}
        {whyItMatters || "This step unlocks higher-quality recommendations and faster campaign execution."}
      </p>
      <p className="mt-2 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Recommended action:</span>{" "}
        {recommendedAction || primaryAction?.label || "Start the guided setup"}
      </p>

      {estimatedTime ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estimated time: {estimatedTime}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {primaryAction ? (
          <Link href={primaryAction.href} className="pm-primary-button rounded-xl px-4 py-2 text-sm font-semibold text-white">
            {primaryAction.label}
          </Link>
        ) : null}
        {secondaryAction ? (
          <Link href={secondaryAction.href} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
            {secondaryAction.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
