import Link from "next/link";
import AdminMutationForm from "@/components/admin/AdminMutationForm";
import AdminNotice from "@/components/admin/AdminNotice";
import EmptyState from "@/components/admin/EmptyState";
import MetricCard from "@/components/admin/MetricCard";
import StatusBadge from "@/components/admin/StatusBadge";
import {
  adjustAccountCreditsAction,
  removeEntitlementOverrideAction,
  resetMonthlyCreditsAction,
  saveEntitlementOverrideAction,
  suspendAccountAction,
  updateAccountPlanAction,
  updateAccountTypeAction,
  updateBillingExemptionAction,
  updateTrialExpirationAction,
} from "@/app/admin/actions";
import { getAdminAccountDetail, listAdminPlans } from "@/features/admin/console";

export default async function AdminAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { accountId } = await params;
  const query = await searchParams;
  const [detail, plans] = await Promise.all([
    getAdminAccountDetail(accountId),
    listAdminPlans(),
  ]);

  return (
    <div className="space-y-6">
      <AdminNotice notice={query.notice} error={query.error} />

      <section className="grid gap-5 lg:grid-cols-4">
        <MetricCard eyebrow="Account" title={detail.account.name} value={detail.account.status} detail={`Plan: ${detail.account.planName}`} />
        <MetricCard eyebrow="Members" title="Member Count" value={String(detail.account.memberCount)} detail={`Account type: ${detail.account.accountTypeLabel}`} />
        <MetricCard eyebrow="Usage" title="AI + Video" value={`${detail.account.aiUsage} / ${detail.account.videoUsage}`} detail="AI runs and video credits consumed" />
        <MetricCard eyebrow="Storage" title="Storage" value={`${Math.round(detail.account.storageUsage / 1048576)} MB`} detail={`Last activity: ${new Date(detail.account.lastActivity).toLocaleString()}`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <article className="pm-glass rounded-[2rem] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Summary</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {detail.account.name}
                </h2>
              </div>
              <StatusBadge status={detail.account.suspendedAt ? "critical" : "healthy"} />
            </div>
            <dl className="mt-6 grid gap-4 md:grid-cols-2 text-sm text-slate-700">
              <div>
                <dt className="font-semibold text-slate-500">Account type</dt>
                <dd className="mt-1">{detail.account.accountTypeLabel}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Billing status</dt>
                <dd className="mt-1">{detail.account.billingStatus}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Trial expires</dt>
                <dd className="mt-1">{detail.account.trialEndsAt ? new Date(detail.account.trialEndsAt).toLocaleDateString() : "Not set"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Billing exempt</dt>
                <dd className="mt-1">{detail.account.billingExempt ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </article>

          <article className="pm-glass rounded-[2rem] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Entitlements</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Effective entitlements</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(detail.entitlements).map(([key, value]) => (
                <div key={key} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{key.replaceAll("_", " ")}</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{String(value)}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="pm-glass rounded-[2rem] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Members</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Account members</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {detail.members.length > 0 ? (
                detail.members.map((member) => (
                  <div key={member.id} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{member.fullName}</p>
                        <p className="text-sm text-slate-500">{member.email || "No email available"}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>{member.role}</p>
                        <p>{member.status}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No members yet" description="This account does not currently have membership records." />
              )}
            </div>
          </article>

          <article className="pm-glass rounded-[2rem] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Activity</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Recent activity and audit history</h2>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                {detail.recentActivity.map((event, index) => (
                  <div key={`${event.type}-${event.at}-${index}`} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">{event.type.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(event.at).toLocaleString()}</p>
                    <p className="mt-2 text-sm text-slate-600">{event.detail}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {detail.auditHistory.map((entry) => (
                  <div key={String(entry.id)} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">{String(entry.action)}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(String(entry.created_at)).toLocaleString()}</p>
                    <p className="mt-2 text-sm text-slate-600">{String(entry.reason || "No reason recorded")}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>

        <aside className="space-y-4">
          <AdminMutationForm
            action={updateAccountTypeAction}
            title="Change account type"
            description="Requires a reason and writes an admin audit event."
            hiddenFields={[
              { name: "accountId", value: accountId },
              { name: "returnPath", value: `/admin/accounts/${accountId}` },
            ]}
            buttonLabel="Save account type"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Account type
              <input name="accountTypeId" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" placeholder="UUID" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Account type key
              <input name="accountTypeKey" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" defaultValue={detail.account.accountTypeKey || "paid_customer"} />
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateAccountPlanAction}
            title="Change plan"
            description="Choose a new pricing plan for this account."
            hiddenFields={[
              { name: "accountId", value: accountId },
              { name: "returnPath", value: `/admin/accounts/${accountId}` },
            ]}
            buttonLabel="Save plan"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pricing plan
              <select name="planId" defaultValue={detail.account.planId || ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({plan.key})
                  </option>
                ))}
              </select>
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={updateBillingExemptionAction}
            title="Toggle billing exemption"
            description="Turns billing exemption on or off for this account."
            hiddenFields={[
              { name: "accountId", value: accountId },
              { name: "returnPath", value: `/admin/accounts/${accountId}` },
            ]}
            buttonLabel="Update exemption"
          >
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
              <input type="checkbox" name="billingExempt" defaultChecked={detail.account.billingExempt} />
              Billing exempt
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={suspendAccountAction}
            title={detail.account.suspendedAt ? "Reactivate account" : "Suspend account"}
            description="Suspension blocks customer access until reactivated."
            hiddenFields={[
              { name: "accountId", value: accountId },
              { name: "returnPath", value: `/admin/accounts/${accountId}` },
              { name: "mode", value: detail.account.suspendedAt ? "reactivate" : "suspend" },
            ]}
            buttonLabel={detail.account.suspendedAt ? "Reactivate account" : "Suspend account"}
          />

          <AdminMutationForm
            action={updateTrialExpirationAction}
            title="Change trial expiration"
            description="Updates the trial expiry date for this account."
            hiddenFields={[
              { name: "accountId", value: accountId },
              { name: "returnPath", value: `/admin/accounts/${accountId}` },
            ]}
            buttonLabel="Save trial expiration"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Trial expires at
              <input type="datetime-local" name="trialEndsAt" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={adjustAccountCreditsAction}
            title="Add or remove credits"
            description="Positive numbers add credits; negative numbers remove them."
            hiddenFields={[
              { name: "accountId", value: accountId },
              { name: "returnPath", value: `/admin/accounts/${accountId}` },
            ]}
            buttonLabel="Adjust credits"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Credit delta
              <input name="delta" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" placeholder="25 or -25" />
            </label>
          </AdminMutationForm>

          <AdminMutationForm
            action={resetMonthlyCreditsAction}
            title="Reset monthly credits"
            description="Resets monthly used credits to zero for the current billing period."
            hiddenFields={[
              { name: "accountId", value: accountId },
              { name: "returnPath", value: `/admin/accounts/${accountId}` },
            ]}
            buttonLabel="Reset monthly credits"
          />

          <AdminMutationForm
            action={saveEntitlementOverrideAction}
            title="Save entitlement override"
            description="Set a specific override or switch back to the plan default."
            hiddenFields={[
              { name: "accountId", value: accountId },
              { name: "returnPath", value: `/admin/accounts/${accountId}` },
            ]}
            buttonLabel="Save override"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Entitlement key
              <input name="entitlementKey" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" placeholder="monthly_ai_credits" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Override mode
              <select name="overrideMode" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                <option value="use_plan">use_plan</option>
                <option value="custom">custom</option>
                <option value="unlimited">unlimited</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Value
              <input name="value" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" placeholder="Number or boolean" />
            </label>
          </AdminMutationForm>

          {detail.overrides.length > 0 ? (
            <div className="space-y-3">
              {detail.overrides.map((override) => (
                <AdminMutationForm
                  key={String(override.id)}
                  action={removeEntitlementOverrideAction}
                  title={`Remove ${String(override.entitlement_key)}`}
                  description={`Current mode: ${String(override.override_mode)}`}
                  hiddenFields={[
                    { name: "accountId", value: accountId },
                    { name: "entitlementKey", value: String(override.entitlement_key) },
                    { name: "returnPath", value: `/admin/accounts/${accountId}` },
                  ]}
                  buttonLabel="Remove override"
                />
              ))}
            </div>
          ) : null}

          <article className="pm-glass rounded-[2rem] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Integrations</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Integration availability</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>TikTok: {detail.integrations.tiktokConfigured ? "Configured" : "Not configured"}</p>
              <p>Amazon Ads: {detail.integrations.amazonAdsConfigured ? "Configured" : "Not configured"}</p>
              <Link className="text-violet-700 underline" href="/admin/system">
                Review full system health
              </Link>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}