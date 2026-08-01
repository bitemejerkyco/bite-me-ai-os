import AdminMutationForm from "@/components/admin/AdminMutationForm";
import AdminNotice from "@/components/admin/AdminNotice";
import AdminTable from "@/components/admin/AdminTable";
import EmptyState from "@/components/admin/EmptyState";
import {
  cancelTikTokLocalPendingJobAction,
  forceTikTokReconnectRequiredAction,
  retryTikTokSafeStatusCheckAction,
  updateTikTokUserBetaAccessAction,
  updateTikTokWorkspaceBetaAccessAction,
} from "@/app/admin/tiktok/actions";
import { updateSystemSettingAction } from "@/app/admin/actions";
import { loadAdminTikTokDashboard } from "@/features/admin/tiktok-dashboard";

function metric(label: string, value: string | number, description?: string) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white/85 p-4 shadow-[0_12px_28px_rgba(76,61,139,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
      {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
    </div>
  );
}

export default async function AdminTikTokPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  const data = await loadAdminTikTokDashboard();

  return (
    <div className="space-y-6">
      <AdminNotice notice={query.notice} error={query.error} />

      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">TikTok admin</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Upload beta operations</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Track beta launch readiness, manage allowlists, and keep every upload within the safe workspace boundary.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metric("Mode", data.mode, data.emergencyDisabled ? "Emergency disable is on" : "Emergency disable is off")}
        {metric("Connected accounts", data.connectedAccounts, `${data.reconnectRequiredAccounts} need reconnect`)}
        {metric("Uploads today", data.uploadsToday, `${data.pendingJobs} pending jobs`)}
        {metric("Inbox deliveries", data.inboxDeliveries, `${data.failedJobs} failed jobs`)}
        {metric("Average processing", `${data.averageProcessingTimeSeconds}s`, "Completed job average")}
        {metric("Verified media", data.verifiedMediaReady ? "Ready" : "Not ready", data.verifiedUrlPrefix || "No verified prefix configured")}
        {metric("Daily limit", data.dailyLimit, "Per workspace")}
        {metric("Pending limit", data.pendingLimit, "Per user, capped at 5")}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <AdminMutationForm
            action={updateSystemSettingAction}
            title="Global TikTok disable"
            description="Emergency override for the entire beta launch."
            hiddenFields={[{ name: "returnPath", value: "/admin/tiktok" }]}
            buttonLabel="Save emergency state"
          >
            <input type="hidden" name="key" value="tiktok_beta_emergency_disabled" />
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Emergency disabled
              <select name="value" defaultValue={String(data.emergencyDisabled)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateSystemSettingAction}
            title="Daily upload limit"
            description="Conservative per-workspace upload cap for the beta."
            hiddenFields={[{ name: "returnPath", value: "/admin/tiktok" }]}
            buttonLabel="Save limit"
          >
            <input type="hidden" name="key" value="tiktok_daily_upload_limit_per_workspace" />
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Daily limit
              <input name="value" defaultValue={String(data.dailyLimit)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateSystemSettingAction}
            title="Pending job limit"
            description="Caps the number of live TikTok jobs a user can hold open at once."
            hiddenFields={[{ name: "returnPath", value: "/admin/tiktok" }]}
            buttonLabel="Save limit"
          >
            <input type="hidden" name="key" value="tiktok_max_pending_jobs_per_user" />
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pending limit
              <input name="value" defaultValue={String(data.pendingLimit)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateSystemSettingAction}
            title="Verified media prefix"
            description="Pull-from-URL is only allowed when TikTok can reach the verified media prefix."
            hiddenFields={[{ name: "returnPath", value: "/admin/tiktok" }]}
            buttonLabel="Save media settings"
          >
            <input type="hidden" name="key" value="tiktok_verified_url_prefix" />
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Verified prefix
              <input name="value" defaultValue={data.verifiedUrlPrefix} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
          </AdminMutationForm>
        </div>

        <div className="space-y-4">
          <AdminMutationForm
            action={updateTikTokWorkspaceBetaAccessAction}
            title="Enable workspace beta access"
            description="Allow a workspace to use TikTok upload-to-draft beta."
            hiddenFields={[{ name: "returnPath", value: "/admin/tiktok" }]}
            buttonLabel="Save workspace access"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Workspace
              <select name="workspaceId" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                {data.workspaceOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Enabled
              <select name="enabled" defaultValue="true" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateTikTokUserBetaAccessAction}
            title="Enable user beta access"
            description="Allow a specific user to use TikTok upload-to-draft beta."
            hiddenFields={[{ name: "returnPath", value: "/admin/tiktok" }]}
            buttonLabel="Save user access"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              User
              <select name="userId" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                {data.userOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Enabled
              <select name="enabled" defaultValue="true" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
          </AdminMutationForm>
        </div>
      </section>

      <AdminTable
        headers={["Workspace", "User", "Allowed", "Daily limit", "Pending limit", "Start", "End", "Actions"]}
        emptyState={data.betaAccounts.length === 0 ? <EmptyState title="No beta allowlist entries" description="Add a workspace or user beta allowance to start testing." /> : undefined}
      >
        {data.betaAccounts.map((row) => (
          <tr key={row.id} className="align-top">
            <td className="px-4 py-4">{row.workspace || "All workspaces"}</td>
            <td className="px-4 py-4">{row.user || "All users"}</td>
            <td className="px-4 py-4">{row.allowed ? "Yes" : "No"}</td>
            <td className="px-4 py-4">{row.dailyLimit}</td>
            <td className="px-4 py-4">{row.pendingLimit}</td>
            <td className="px-4 py-4">{row.startDate || "Open"}</td>
            <td className="px-4 py-4">{row.endDate || "Open"}</td>
            <td className="px-4 py-4 text-xs text-slate-500">Reason: {row.reason || "Not recorded"}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        headers={["Workspace", "TikTok identity", "Scopes", "Status", "Last refreshed", "Reconnect", "Action"]}
        emptyState={data.connectionsTable.length === 0 ? <EmptyState title="No TikTok connections" description="Connections will appear after a workspace connects." /> : undefined}
      >
        {data.connectionsTable.map((row) => (
          <tr key={row.id} className="align-top">
            <td className="px-4 py-4">{row.workspace}</td>
            <td className="px-4 py-4">{row.tikTokIdentity}</td>
            <td className="px-4 py-4">{row.scopes.join(", ") || "None"}</td>
            <td className="px-4 py-4">{row.status}</td>
            <td className="px-4 py-4">{row.lastRefreshed}</td>
            <td className="px-4 py-4">{row.reconnectRequired ? "Yes" : "No"}</td>
            <td className="px-4 py-4">
              <AdminMutationForm
                action={forceTikTokReconnectRequiredAction}
                title="Force reconnect"
                description="Marks the connection reconnect-required and requires a reason."
                hiddenFields={[
                  { name: "returnPath", value: "/admin/tiktok" },
                  { name: "connectionId", value: row.id },
                ]}
                buttonLabel="Force reconnect"
              />
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        headers={["Workspace", "User", "Mode", "Status", "Media asset", "Error code", "Actions"]}
        emptyState={data.jobsTable.length === 0 ? <EmptyState title="No TikTok jobs" description="Upload jobs will appear here once the beta is used." /> : undefined}
      >
        {data.jobsTable.map((row) => (
          <tr key={row.id} className="align-top">
            <td className="px-4 py-4">{row.workspace}</td>
            <td className="px-4 py-4">{row.user || "Unknown"}</td>
            <td className="px-4 py-4">{row.mode}</td>
            <td className="px-4 py-4">{row.status}</td>
            <td className="px-4 py-4">{row.mediaAsset || "Unknown"}</td>
            <td className="px-4 py-4">{row.errorCode || "-"}</td>
            <td className="px-4 py-4 space-y-2">
              <AdminMutationForm
                action={retryTikTokSafeStatusCheckAction}
                title="Retry status"
                description="Runs a bounded, safe status refresh for this job."
                hiddenFields={[
                  { name: "returnPath", value: "/admin/tiktok" },
                  { name: "workspaceId", value: row.workspaceId },
                  { name: "jobId", value: row.id },
                ]}
                buttonLabel="Retry status"
              />
              <AdminMutationForm
                action={cancelTikTokLocalPendingJobAction}
                title="Cancel pending job"
                description="Cancels the local job record only."
                hiddenFields={[
                  { name: "returnPath", value: "/admin/tiktok" },
                  { name: "jobId", value: row.id },
                ]}
                buttonLabel="Cancel job"
              />
            </td>
          </tr>
        ))}
      </AdminTable>

      <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-6">
        <h2 className="text-xl font-bold text-slate-900">Top failure reasons</h2>
        {data.topFailureReasons.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No failures yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {data.topFailureReasons.map((entry) => (
              <li key={entry.key} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                <span>{entry.key}</span>
                <span className="font-semibold text-slate-900">{entry.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}