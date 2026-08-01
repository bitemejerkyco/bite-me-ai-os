import Link from "next/link";

export default function GuidedEmptyState({
  title,
  description,
  estimatedTime,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  description: string;
  estimatedTime?: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}) {
  return (
    <div className="rounded-[1.7rem] border border-dashed border-slate-300 bg-slate-50/80 p-6 text-left">
      <p className="text-lg font-black tracking-tight text-slate-900">{title}</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      {estimatedTime ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estimated time: {estimatedTime}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {primaryAction ? (
          <Link href={primaryAction.href} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
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
