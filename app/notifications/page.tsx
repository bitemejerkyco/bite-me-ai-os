import AppShell from "@/components/AppShell";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function NotificationsPage() {
  const context = await requireWorkspaceContext();
  const admin = createAdminClient();
  const { data } = await admin
    .from("marketing_notifications")
    .select("id,event_type,status,message,created_at")
    .eq("workspace_id", context.workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (data as Array<Record<string, unknown>> | null) || [];

  return (
    <AppShell title="Notifications" eyebrow="Approval, publishing, and workflow updates">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        {notifications.length === 0 ? (
          <GuidedEmptyState title="No notifications yet." description="Notifications will appear here when approvals, workflow events, analytics updates, or failures need attention." estimatedTime="As the workspace becomes active" primaryAction={{ label: "Open Dashboard", href: "/" }} secondaryAction={{ label: "Learn how notifications work", href: "/help" }} />
        ) : (
          <div className="space-y-3">
            {notifications.map((item) => (
              <article key={String(item.id)} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{String(item.event_type || "Notification")}</p>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{String(item.status || "UNKNOWN")}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{String(item.message || "No message recorded.")}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(String(item.created_at || new Date().toISOString())).toLocaleString()}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
