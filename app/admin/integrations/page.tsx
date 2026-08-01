import AdminMutationForm from "@/components/admin/AdminMutationForm";
import AdminNotice from "@/components/admin/AdminNotice";
import AdminTable from "@/components/admin/AdminTable";
import EmptyState from "@/components/admin/EmptyState";
import { loadAdminIntegrationsDashboard } from "@/features/admin/integrations-dashboard";
import {
  retryIntegrationJobAction,
  updateIntegrationProviderControlsAction,
} from "@/app/admin/integrations/actions";

function metric(label: string, value: string | number, description?: string) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white/85 p-4 shadow-[0_12px_28px_rgba(76,61,139,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
      {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
    </div>
  );
}

function boolSelect(name: string, value: boolean) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {name}
      <select
        name={name}
        defaultValue={value ? "true" : "false"}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </label>
  );
}

export default async function AdminIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  const data = await loadAdminIntegrationsDashboard();

  return (
    <div className="space-y-6">
      <AdminNotice notice={query.notice} error={query.error} />

      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Integration operations</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Provider reliability and kill switches</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Live providers are TikTok and Amazon Ads. Other providers are intentionally marked as coming soon until a production adapter is fully implemented.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metric("Live providers", data.summary.liveProviders)}
        {metric("Enabled providers", data.summary.enabledProviders)}
        {metric("Critical providers", data.summary.criticalProviders, "Providers with repeated failed jobs")}
        {metric("Warning providers", data.summary.warningProviders, "Providers with recent job failures")}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {data.providers.map((provider) => (
          <AdminMutationForm
            key={provider.id}
            action={updateIntegrationProviderControlsAction}
            title={`${provider.label} controls`}
            description={`${provider.healthMessage} Support level: ${provider.supportLevel}${provider.readOnly ? " (read-only adapter)" : ""}.`}
            hiddenFields={[{ name: "provider", value: provider.id }]}
            buttonLabel="Save controls"
          >
            {boolSelect("globallyEnabled", provider.controls.globallyEnabled)}
            {boolSelect("oauthEnabled", provider.controls.oauthEnabled)}
            {boolSelect("publishingEnabled", provider.controls.publishingEnabled)}
            {boolSelect("analyticsEnabled", provider.controls.analyticsEnabled)}
            {boolSelect("webhooksEnabled", provider.controls.webhooksEnabled)}
            {boolSelect("backgroundSyncEnabled", provider.controls.backgroundSyncEnabled)}
            {boolSelect("maintenanceMode", provider.controls.maintenanceMode)}
          </AdminMutationForm>
        ))}
      </section>

      <AdminTable
        headers={["Provider", "Connections", "Failed jobs", "Status", "Controls updated"]}
        emptyState={<EmptyState title="No provider data" description="Integration controls will appear after migrations are applied." />}
      >
        {data.providers.map((provider) => (
          <tr key={`provider-${provider.id}`} className="align-top">
            <td className="px-4 py-4">{provider.label}</td>
            <td className="px-4 py-4">{provider.configuredConnections}</td>
            <td className="px-4 py-4">{provider.failedJobs}</td>
            <td className="px-4 py-4">{provider.healthStatus}</td>
            <td className="px-4 py-4">{provider.controls.updatedAt ? new Date(provider.controls.updatedAt).toLocaleString() : "-"}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        headers={["Job", "Workspace", "Provider", "Type", "Status", "Attempts", "Error", "Action"]}
        emptyState={
          data.jobs.length === 0
            ? <EmptyState title="No integration jobs" description="Jobs will appear when background execution is active." />
            : undefined
        }
      >
        {data.jobs.map((job) => (
          <tr key={job.id} className="align-top">
            <td className="px-4 py-4">{job.id}</td>
            <td className="px-4 py-4">{job.workspaceId}</td>
            <td className="px-4 py-4">{job.provider}</td>
            <td className="px-4 py-4">{job.jobType}</td>
            <td className="px-4 py-4">{job.status}</td>
            <td className="px-4 py-4">{job.attempts}</td>
            <td className="px-4 py-4">{job.errorCode}</td>
            <td className="px-4 py-4">
              {job.canRetry ? (
                <AdminMutationForm
                  action={retryIntegrationJobAction}
                  title="Requeue job"
                  description="Requeues a failed integration job for another execution attempt."
                  hiddenFields={[{ name: "jobId", value: job.id }]}
                  buttonLabel="Requeue"
                />
              ) : (
                <span className="text-xs text-slate-500">No action</span>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminTable
        headers={["Time", "Provider", "Severity", "Message"]}
        emptyState={
          data.events.length === 0
            ? <EmptyState title="No integration events" description="Events are captured when provider operations execute." />
            : undefined
        }
      >
        {data.events.map((event) => (
          <tr key={event.id} className="align-top">
            <td className="px-4 py-4">{new Date(event.createdAt).toLocaleString()}</td>
            <td className="px-4 py-4">{event.provider}</td>
            <td className="px-4 py-4">{event.severity}</td>
            <td className="px-4 py-4">{event.message}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
