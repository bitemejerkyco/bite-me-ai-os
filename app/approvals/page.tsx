import AppShell from "@/components/AppShell";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ApprovalsPage() {
  const context = await requireWorkspaceContext();
  const admin = createAdminClient();
  const { data } = await admin
    .from("marketing_approval_items")
    .select("id,title,item_type,status,created_at,target_record_type,target_record_id")
    .eq("workspace_id", context.workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  const items = (data as Array<Record<string, unknown>> | null) || [];

  return (
    <AppShell title="Approval Center" eyebrow="Human review and workflow safety">
      <section data-help="approvals-filters" className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <p className="text-sm leading-6 text-slate-600">
          Review items that require a human decision before content, scheduling, or recommendation workflows can continue.
        </p>
      </section>
      <section data-help="approvals-list" className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        {items.length === 0 ? (
          <GuidedEmptyState title="No approvals waiting." description="Approvals will appear here when drafts, schedules, or recommendations require human review." estimatedTime="When new review work arrives" primaryAction={{ label: "Open Content Library", href: "/content" }} secondaryAction={{ label: "Learn the approval flow", href: "/help" }} />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={String(item.id)} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{String(item.title || "Approval item")}</p>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{String(item.status || "UNKNOWN")}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{String(item.item_type || "workflow")} · {new Date(String(item.created_at || new Date().toISOString())).toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-500">Target: {String(item.target_record_type || "record")} · {String(item.target_record_id || "n/a")}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
