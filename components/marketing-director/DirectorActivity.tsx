"use client";

import { useEffect, useState } from "react";

type ActivityStatus =
  | "request"
  | "plan_generated"
  | "approval_requested"
  | "approved"
  | "rejected"
  | "draft_created"
  | "completed"
  | "failed";

type ActivityItem = {
  id: string;
  status: ActivityStatus;
  timestamp: string;
  userId: string | null;
  planId: string;
  request: string;
  details: string;
};

type Filter = "all" | "plans" | "approvals" | "completed" | "failed";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "plans", label: "Plans" },
  { value: "approvals", label: "Approvals" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

function statusLabel(status: ActivityStatus): string {
  return status.replaceAll("_", " ");
}

function statusTone(status: ActivityStatus): string {
  if (status === "failed" || status === "rejected") return "text-rose-700 bg-rose-50 border-rose-200";
  if (status === "approved" || status === "completed") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status === "approval_requested") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-violet-700 bg-violet-50 border-violet-200";
}

export default function DirectorActivity() {
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  async function load(nextFilter: Filter, nextOffset: number, append: boolean) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/marketing-director/command/history?filter=${nextFilter}&limit=10&offset=${nextOffset}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        items?: ActivityItem[];
        nextOffset?: number;
        hasMore?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error || "Unable to load director activity.");
        return;
      }

      const nextItems = payload.items || [];
      setItems((current) => append ? [...current, ...nextItems] : nextItems);
      setOffset(typeof payload.nextOffset === "number" ? payload.nextOffset : nextOffset + nextItems.length);
      setHasMore(Boolean(payload.hasMore));
    } catch {
      setError("Unable to load director activity.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
    });

    void fetch(`/api/marketing-director/command/history?filter=${filter}&limit=10&offset=0`, {
      method: "GET",
      cache: "no-store",
    })
      .then((response) => response.json().catch(() => null).then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!active) return;
        const data = payload as {
          ok?: boolean;
          error?: string;
          items?: ActivityItem[];
          nextOffset?: number;
          hasMore?: boolean;
        } | null;

        if (!response.ok || !data?.ok) {
          setError(data?.error || "Unable to load director activity.");
          return;
        }

        const nextItems = data.items || [];
        setItems(nextItems);
        setOffset(typeof data.nextOffset === "number" ? data.nextOffset : nextItems.length);
        setHasMore(Boolean(data.hasMore));
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load director activity.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filter]);

  return (
    <section className="pm-glass-premium rounded-[2rem] border border-white/90 bg-white/80 p-4" aria-label="Director Activity">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Recent Activity</p>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                filter === option.value
                  ? "border-violet-300 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-white/85 p-3">
              <div className="pm-skeleton h-3 w-28" />
              <div className="mt-2 pm-skeleton h-4 w-3/4" />
              <div className="mt-2 pm-skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {items.length === 0 && !loading ? (
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">No activity has been recorded for this filter yet.</p>
            <p className="mt-1">As soon as AI generates plans, approvals move, or integrations sync, timeline events appear here.</p>
          </div>
        ) : null}

        {items.map((item) => (
          <article key={item.id} className="pm-lift relative rounded-xl border border-slate-200 bg-white/90 p-3 pl-6">
            <span className="absolute left-2 top-5 h-2.5 w-2.5 rounded-full bg-violet-500" aria-hidden="true" />
            <span className="absolute left-[0.82rem] top-8 h-[calc(100%-2rem)] w-px bg-slate-200" aria-hidden="true" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusTone(item.status)}`}>{statusLabel(item.status)}</p>
              <p className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">{item.request}</p>
            <p className="mt-1 text-sm text-slate-700">{item.details}</p>
            <p className="mt-2 text-xs text-slate-500">Plan: {item.planId} · User: {item.userId || "unknown"}</p>
          </article>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {loading ? <p className="text-xs text-slate-500">Refreshing your timeline...</p> : <span />}
        {hasMore ? (
          <button
            type="button"
            onClick={() => void load(filter, offset, true)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            View more
          </button>
        ) : null}
      </div>
    </section>
  );
}
