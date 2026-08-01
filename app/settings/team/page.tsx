import AppShell from "@/components/AppShell";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export default async function TeamSettingsPage() {
  const context = await requireWorkspaceContext();
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_memberships")
    .select("user_id,role,status,created_at")
    .eq("workspace_id", context.workspaceId)
    .order("created_at", { ascending: true });

  const members = (data as Array<Record<string, unknown>> | null) || [];

  return (
    <AppShell title="Team Settings" eyebrow="Workspace roles and collaboration guidance">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        {members.length === 0 ? (
          <GuidedEmptyState title="No team members found." description="Workspace membership records will appear here as roles and invitations are used." estimatedTime="When members are added" primaryAction={{ label: "Open Help Center", href: "/help" }} secondaryAction={{ label: "Open Account Settings", href: "/settings/account" }} />
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <article key={`${String(member.user_id)}-${String(member.role)}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">User {String(member.user_id).slice(0, 8)}</p>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{String(member.role || "MEMBER")}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">Status: {String(member.status || "UNKNOWN")}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
