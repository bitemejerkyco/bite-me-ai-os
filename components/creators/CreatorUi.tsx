import Link from "next/link";
import type { Creator } from "@/features/creators/types";

export function DemoBadge() {
  return (
    <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
      Demo Workspace Data
    </span>
  );
}

export function MetricTile(props: { label: string; value: string; status?: "measured" | "estimated" | "demo" }) {
  const statusLabel = props.status ? props.status.toUpperCase() : null;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{props.value}</p>
      {statusLabel ? <p className="mt-1 text-xs font-semibold text-slate-500">{statusLabel}</p> : null}
    </article>
  );
}

export function CreatorCard(props: { creator: Creator; whyMatch?: string; actions?: Array<{ href: string; label: string }> }) {
  const { creator } = props;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{creator.displayName}</p>
          <p className="text-xs text-slate-500">{creator.handle} · {creator.location}</p>
        </div>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">AI Match {creator.matchScore}</span>
      </div>
      <p className="mt-3 text-sm text-slate-600">{creator.bio}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {creator.niches.map((niche) => (
          <span key={niche} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">{niche}</span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Followers {creator.followerCount.toLocaleString()} · Avg views {creator.averageViews.toLocaleString()} · Engagement {(creator.engagementRate * 100).toFixed(1)}%
      </p>
      <p className="mt-1 text-xs text-slate-500">Est. rate ${creator.estimatedRateMin.toLocaleString()}-${creator.estimatedRateMax.toLocaleString()} {creator.currency}</p>
      {props.whyMatch ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{props.whyMatch}</p> : null}
      {props.actions?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.actions.map((action) => (
            <Link key={`${creator.id}-${action.href}-${action.label}`} href={action.href} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function EmptyPanel(props: { title: string; description: string }) {
  return (
    <div className="rounded-[1.8rem] border border-slate-200 bg-white/90 p-6">
      <p className="text-lg font-black tracking-tight text-slate-900">{props.title}</p>
      <p className="mt-2 text-sm text-slate-600">{props.description}</p>
    </div>
  );
}
