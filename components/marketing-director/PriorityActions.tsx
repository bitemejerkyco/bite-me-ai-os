import Link from "next/link";
import type { PriorityAction } from "@/features/marketing-director/daily-brief-rules";

const priorityTone: Record<PriorityAction["priority"], string> = {
  critical: "border-rose-200 bg-rose-50/85",
  high: "border-amber-200 bg-amber-50/80",
  medium: "border-blue-200 bg-blue-50/80",
  low: "border-slate-200 bg-slate-100/85",
  completed: "border-emerald-200 bg-emerald-50/85",
};

export default function PriorityActions({ actions }: { actions: PriorityAction[] }) {
  return (
    <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Priority Actions</p>
      <div className="mt-4 space-y-3">
        {actions.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-600">
            No open priority actions right now.
          </p>
        ) : (
          actions.slice(0, 8).map((action) => (
            <article key={action.id} className={`rounded-2xl border p-4 ${priorityTone[action.priority]}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{action.title}</h3>
                <span className="rounded-full border border-white/90 bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
                  {action.priority}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{action.description}</p>
              <Link href={action.href} className="mt-3 inline-flex text-xs font-semibold text-violet-700 hover:text-violet-600">
                Open action
              </Link>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
