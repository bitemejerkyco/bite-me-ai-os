import AdminMutationForm from "@/components/admin/AdminMutationForm";
import StatusBadge from "@/components/admin/StatusBadge";
import { refreshSystemHealthAction } from "@/app/admin/actions";
import { loadAdminSystemPageData } from "@/features/admin/console";

export default async function AdminSystemPage() {
  const { health, auditLogs, settings } = await loadAdminSystemPageData();

  return (
    <div className="space-y-6">
      <section className="pm-glass rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">System Health</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Platform health</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Safe, lightweight checks only. Services without a real health source are labeled accordingly.
            </p>
          </div>
          <StatusBadge status={health.overallStatus} />
        </div>
      </section>

      <AdminMutationForm
        action={refreshSystemHealthAction}
        title="Refresh health checks"
        description="Manually refreshes server-rendered health data without aggressive polling."
        hiddenFields={[{ name: "returnPath", value: "/admin/system" }]}
        buttonLabel="Refresh system health"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {health.checks.map((check) => (
          <article key={check.key} className="pm-glass rounded-[2rem] p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">{check.displayName}</h3>
              <StatusBadge status={check.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{check.message}</p>
            <dl className="mt-4 space-y-2 text-xs text-slate-500">
              <div className="flex items-center justify-between gap-3">
                <dt>Checked</dt>
                <dd>{new Date(check.checkedAt).toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Latency</dt>
                <dd>{check.latencyMs ?? "Unavailable"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Source</dt>
                <dd>{check.source}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="pm-glass rounded-[2rem] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Recent incidents</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Recent admin events</h2>
          <div className="mt-4 space-y-3">
            {auditLogs.map((entry) => (
              <div key={String(entry.id)} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">{String(entry.action)}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(String(entry.created_at)).toLocaleString()}</p>
                <p className="mt-2 text-sm text-slate-600">{String(entry.reason || "No reason recorded")}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="pm-glass rounded-[2rem] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Operational settings</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Current setting snapshot</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {settings.slice(0, 8).map((setting) => (
              <div key={setting.id} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                <p className="font-semibold text-slate-900">{setting.key}</p>
                <p className="mt-2 text-xs text-slate-500">{JSON.stringify(setting.value)}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}