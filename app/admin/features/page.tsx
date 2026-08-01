import AdminMutationForm from "@/components/admin/AdminMutationForm";
import AdminNotice from "@/components/admin/AdminNotice";
import AdminTable from "@/components/admin/AdminTable";
import EmptyState from "@/components/admin/EmptyState";
import {
  removeFeatureFlagOverrideAction,
  saveFeatureFlagOverrideAction,
  updateFeatureFlagAction,
  updateSystemSettingAction,
} from "@/app/admin/actions";
import { loadAdminFeaturesPageData } from "@/features/admin/console";

function settingValue(
  settings: Array<{ key: string; value: unknown }>,
  key: string,
  fallback = "",
) {
  const match = settings.find((setting) => setting.key === key);
  return String(match?.value ?? fallback);
}

export default async function AdminFeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { flags, accounts, overrides, settings } = await loadAdminFeaturesPageData();
  const mode = settingValue(settings, "tiktok_content_posting_mode", "beta_upload");
  const webhooksEnabled = settingValue(settings, "tiktok_webhooks_enabled", "false") === "true";
  const emergencyDisabled = settingValue(settings, "tiktok_beta_emergency_disabled", "false") === "true";
  const dailyLimit = settingValue(settings, "tiktok_daily_upload_limit_per_workspace", "5");
  const pendingLimit = settingValue(settings, "tiktok_max_pending_jobs_per_user", "5");
  const mediaBaseUrl = settingValue(settings, "tiktok_media_base_url", "");
  const verifiedUrlPrefix = settingValue(settings, "tiktok_verified_url_prefix", "");

  return (
    <div className="space-y-6">
      <AdminNotice notice={query.notice} error={query.error} />

      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Features</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Database-backed feature flags</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Resolution order is enforced server-side: emergency disable, account override, allowed account type, allowed plan, rollout, then global enabled state.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="pm-glass rounded-[2rem] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">TikTok beta</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Launch controls</h2>
          <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mode</p>
              <p className="mt-2 font-semibold text-slate-900">{mode}</p>
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Emergency disable</p>
              <p className="mt-2 font-semibold text-slate-900">{emergencyDisabled ? "Enabled" : "Disabled"}</p>
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Daily upload limit</p>
              <p className="mt-2 font-semibold text-slate-900">{dailyLimit}</p>
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pending jobs per user</p>
              <p className="mt-2 font-semibold text-slate-900">{pendingLimit}</p>
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Media base URL</p>
              <p className="mt-2 break-all font-semibold text-slate-900">{mediaBaseUrl || "Not configured"}</p>
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verified URL prefix</p>
              <p className="mt-2 break-all font-semibold text-slate-900">{verifiedUrlPrefix || "Not configured"}</p>
            </div>
            <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Webhooks</p>
              <p className="mt-2 font-semibold text-slate-900">{webhooksEnabled ? "Enabled" : "Disabled"}</p>
            </div>
          </div>
        </article>

        <div className="space-y-4">
          <AdminMutationForm
            action={updateSystemSettingAction}
            title="Update TikTok mode"
            description="Controls whether TikTok is disabled, sandboxed, in beta upload mode, or direct post mode."
            hiddenFields={[{ name: "returnPath", value: "/admin/features" }]}
            buttonLabel="Save mode"
          >
            <input type="hidden" name="key" value="tiktok_content_posting_mode" />
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Mode
              <select name="value" defaultValue={mode} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                <option value="disabled">disabled</option>
                <option value="sandbox">sandbox</option>
                <option value="beta_upload">beta_upload</option>
                <option value="direct_post">direct_post</option>
              </select>
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateSystemSettingAction}
            title="Update TikTok upload limit"
            description="Sets the conservative daily upload cap used during the beta launch."
            hiddenFields={[{ name: "returnPath", value: "/admin/features" }]}
            buttonLabel="Save limit"
          >
            <input type="hidden" name="key" value="tiktok_daily_upload_limit_per_workspace" />
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Daily uploads per workspace
              <input name="value" defaultValue={dailyLimit} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateSystemSettingAction}
            title="Update TikTok pending job limit"
            description="Caps the number of pending jobs a user can have at once."
            hiddenFields={[{ name: "returnPath", value: "/admin/features" }]}
            buttonLabel="Save limit"
          >
            <input type="hidden" name="key" value="tiktok_max_pending_jobs_per_user" />
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pending jobs per user
              <input name="value" defaultValue={pendingLimit} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateSystemSettingAction}
            title="Update TikTok media URL prefix"
            description="Verified HTTPS media URLs let TikTok pull server-hosted videos without session cookies."
            hiddenFields={[{ name: "returnPath", value: "/admin/features" }]}
            buttonLabel="Save URL settings"
          >
            <input type="hidden" name="key" value="tiktok_media_base_url" />
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Media base URL
              <input name="value" defaultValue={mediaBaseUrl} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateSystemSettingAction}
            title="Update TikTok verified URL prefix"
            description="TikTok pull-from-url is disabled until a verified HTTPS prefix is configured."
            hiddenFields={[{ name: "returnPath", value: "/admin/features" }]}
            buttonLabel="Save URL prefix"
          >
            <input type="hidden" name="key" value="tiktok_verified_url_prefix" />
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Verified URL prefix
              <input name="value" defaultValue={verifiedUrlPrefix} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateSystemSettingAction}
            title="Toggle TikTok webhooks"
            description="Keep webhooks disabled until TikTok publishes a verified event contract for this app."
            hiddenFields={[{ name: "returnPath", value: "/admin/features" }]}
            buttonLabel="Save webhook state"
          >
            <input type="hidden" name="key" value="tiktok_webhooks_enabled" />
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Webhooks
              <select name="value" defaultValue={String(webhooksEnabled)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                <option value="true">enabled</option>
                <option value="false">disabled</option>
              </select>
            </label>
          </AdminMutationForm>
        </div>
      </section>

      <AdminTable
        headers={["Flag", "Enabled", "Rollout", "Allowed account types", "Allowed plans", "Actions"]}
        emptyState={flags.length === 0 ? <EmptyState title="No feature flags" description="Seeded feature flags should appear here once the migration is applied." /> : undefined}
      >
        {flags.map((flag) => (
          <tr key={flag.id} className="align-top">
            <td className="px-4 py-4">
              <p className="font-semibold text-slate-900">{flag.displayName}</p>
              <p className="mt-1 text-xs text-slate-500">{flag.key}</p>
            </td>
            <td className="px-4 py-4">{flag.enabled ? "Enabled" : "Disabled"}</td>
            <td className="px-4 py-4">{flag.rolloutPercentage}%</td>
            <td className="px-4 py-4">{flag.allowedAccountTypes.join(", ") || "All"}</td>
            <td className="px-4 py-4">{flag.allowedPlanKeys.join(", ") || "All"}</td>
            <td className="px-4 py-4">
              <AdminMutationForm
                action={updateFeatureFlagAction}
                title={`Update ${flag.displayName}`}
                description={flag.description}
                hiddenFields={[
                  { name: "featureFlagId", value: flag.id },
                  { name: "returnPath", value: "/admin/features" },
                ]}
                buttonLabel="Save feature flag"
              >
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
                  <input type="checkbox" name="enabled" defaultChecked={flag.enabled} /> Enabled
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Rollout percentage
                  <input name="rolloutPercentage" defaultValue={String(flag.rolloutPercentage)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Allowed plan keys
                  <input name="allowedPlanKeys" defaultValue={flag.allowedPlanKeys.join(", ")} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Allowed account types
                  <input name="allowedAccountTypes" defaultValue={flag.allowedAccountTypes.join(", ")} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
                </label>
              </AdminMutationForm>
            </td>
          </tr>
        ))}
      </AdminTable>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminMutationForm
          action={saveFeatureFlagOverrideAction}
          title="Save account override"
          description="Overrides the feature flag for a specific account."
          hiddenFields={[{ name: "returnPath", value: "/admin/features" }]}
          buttonLabel="Save override"
        >
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Account
            <select name="accountId" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Feature flag
            <select name="featureFlagId" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
              {flags.map((flag) => (
                <option key={flag.id} value={flag.id}>{flag.displayName}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
            <input type="checkbox" name="enabled" defaultChecked /> Enabled
          </label>
        </AdminMutationForm>

        <div className="space-y-4">
          {overrides.length > 0 ? (
            overrides.map((override) => (
              <AdminMutationForm
                key={String(override.id)}
                action={removeFeatureFlagOverrideAction}
                title={`Remove override ${String(override.id)}`}
                description={`Account ${String(override.account_id)} · Feature ${String(override.feature_flag_id)}`}
                hiddenFields={[
                  { name: "featureFlagId", value: String(override.feature_flag_id) },
                  { name: "accountId", value: String(override.account_id) },
                  { name: "returnPath", value: "/admin/features" },
                ]}
                buttonLabel="Remove override"
              />
            ))
          ) : (
            <EmptyState title="No overrides yet" description="Feature flag overrides will appear here once account-specific exceptions are created." />
          )}
        </div>
      </section>
    </div>
  );
}