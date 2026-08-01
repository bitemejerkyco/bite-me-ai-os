import MetricCard from "@/components/admin/MetricCard";
import { loadAdminOperationsOverview } from "@/features/platform/monitoring/overview";

function asText(value: unknown, fallback = "unknown"): string {
  const text = String(value || "").trim();
  return text || fallback;
}

export default async function AdminOperationsPage() {
  const data = await loadAdminOperationsOverview();
  const latestSnapshot = data.snapshots[0];

  return (
    <div className="space-y-6">
      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Operations</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Launch readiness command center</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Snapshot visibility for monitoring, backup and restore, replay operations, and open support queues.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard eyebrow="Monitoring" title="Server health" value={asText(latestSnapshot?.server_health, "Unknown")} detail={latestSnapshot?.captured_at ? `Captured ${new Date(asText(latestSnapshot?.captured_at)).toLocaleString()}` : "No capture yet"} />
        <MetricCard eyebrow="Monitoring" title="Queue depth" value={String(latestSnapshot?.queue_depth ?? 0)} detail={`Worker health: ${asText(latestSnapshot?.worker_health, "unknown")}`} />
        <MetricCard eyebrow="Failures" title="Publishing" value={String(latestSnapshot?.publishing_failures ?? 0)} detail={`OAuth failures: ${String(latestSnapshot?.oauth_failures ?? 0)}`} tone={(latestSnapshot?.publishing_failures || 0) > 0 ? "warning" : "default"} />
        <MetricCard eyebrow="DR" title="Recent backups" value={String(data.backupRuns.length)} detail={`Restore tests: ${String(data.restoreTests.length)}`} />
        <MetricCard eyebrow="Support" title="Open threads" value={String(data.openSupportThreads)} detail={`Replay operations: ${String(data.replayOperations.length)}`} tone={data.openSupportThreads > 0 ? "warning" : "default"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[1.7rem] border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Backup and restore</h3>
          <div className="mt-4 space-y-3">
            {data.backupRuns.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No backup runs recorded yet.</p>
            ) : (
              data.backupRuns.map((run) => (
                <div key={asText(run.id, "-backup")} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{asText(run.backup_scope)} backup · {asText(run.status)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Started {run.started_at ? new Date(run.started_at).toLocaleString() : "unknown"}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-[1.7rem] border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Replay operations</h3>
          <div className="mt-4 space-y-3">
            {data.replayOperations.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No replay operations queued.</p>
            ) : (
              data.replayOperations.map((operation) => (
                <div key={asText(operation.id, "-replay")} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">{asText(operation.replay_type)} · {asText(operation.status)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Created {operation.created_at ? new Date(operation.created_at).toLocaleString() : "unknown"}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-black tracking-tight text-slate-900">Restore validation</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.restoreTests.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No restore tests recorded.</p>
          ) : (
            data.restoreTests.map((test) => (
              <div key={asText(test.id, "-restore")} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{asText(test.status)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Started {test.started_at ? new Date(test.started_at).toLocaleString() : "unknown"}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
