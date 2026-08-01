import AppShell from "@/components/AppShell";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function PublishingQueuePage() {
  const context = await requireWorkspaceContext();
  const admin = createAdminClient();
  const { data } = await admin
    .from("scheduled_posts")
    .select("id,title,channel,status,scheduled_for,entry_type,failure_reason")
    .eq("workspace_id", context.workspaceId)
    .order("scheduled_for", { ascending: false })
    .limit(100);

  const items = (data as Array<Record<string, unknown>> | null) || [];

  return (
    <AppShell title="Publishing Queue" eyebrow="Execution state after scheduling">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        {items.length === 0 ? (
          <GuidedEmptyState title="Nothing is waiting to publish" description="Approved and scheduled content will appear here." estimatedTime="2 minutes" primaryAction={{ label: "Open Calendar", href: "/calendar" }} secondaryAction={{ label: "Learn the publishing flow", href: "/help" }} />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={String(item.id)} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{String(item.title || "Scheduled item")}</p>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{String(item.status || "UNKNOWN")}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{String(item.channel || "Channel")} · {new Date(String(item.scheduled_for || new Date().toISOString())).toLocaleString()}</p>
                {item.failure_reason ? <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{String(item.failure_reason)}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
