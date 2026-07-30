import AdminMutationForm from "@/components/admin/AdminMutationForm";
import AdminNotice from "@/components/admin/AdminNotice";
import AdminTable from "@/components/admin/AdminTable";
import EmptyState from "@/components/admin/EmptyState";
import {
  removeFeatureFlagOverrideAction,
  saveFeatureFlagOverrideAction,
  updateFeatureFlagAction,
} from "@/app/admin/actions";
import { loadAdminFeaturesPageData } from "@/features/admin/console";

export default async function AdminFeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { flags, accounts, overrides } = await loadAdminFeaturesPageData();

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