import AdminMutationForm from "@/components/admin/AdminMutationForm";
import AdminNotice from "@/components/admin/AdminNotice";
import EmptyState from "@/components/admin/EmptyState";
import {
  archivePlanAction,
  duplicatePlanAction,
  publishPlanAction,
  updatePlanAction,
} from "@/app/admin/actions";
import { getAdminPlanDetail } from "@/features/admin/console";

export default async function AdminPlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { planId } = await params;
  const query = await searchParams;
  const plan = await getAdminPlanDetail(planId);

  return (
    <div className="space-y-6">
      <AdminNotice notice={query.notice} error={query.error} />

      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Plan detail</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{plan.name}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{plan.description || "No description yet."}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-slate-700">
          <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">State</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{plan.lifecycle_state}</p>
          </div>
          <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Accounts</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{plan.accountCount}</p>
          </div>
          <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Monthly</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{plan.currency} {plan.monthly_price_cents / 100}</p>
          </div>
          <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Annual</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{plan.currency} {plan.annual_price_cents / 100}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminMutationForm
          action={updatePlanAction}
          title="Edit pricing plan"
          description="Updates plan metadata, prices, visibility, and entitlement summary."
          hiddenFields={[
            { name: "planId", value: planId },
            { name: "returnPath", value: `/admin/plans/${planId}` },
          ]}
          buttonLabel="Save pricing plan"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Name
              <input name="name" defaultValue={plan.name} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Key
              <input name="key" defaultValue={plan.key} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 md:col-span-2">
              Description
              <textarea name="description" defaultValue={plan.description} className="mt-2 h-24 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Monthly price cents
              <input name="monthlyPriceCents" defaultValue={String(plan.monthly_price_cents)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Annual price cents
              <input name="annualPriceCents" defaultValue={String(plan.annual_price_cents)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Currency
              <input name="currency" defaultValue={plan.currency} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Sort order
              <input name="sortOrder" defaultValue={String(plan.sort_order)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
              <input type="checkbox" name="isPublic" defaultChecked={plan.is_public} /> Public
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
              <input type="checkbox" name="isActive" defaultChecked={plan.is_active} /> Active
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["monthly_ai_credits", "Monthly AI credits"],
              ["monthly_video_credits", "Monthly video credits"],
              ["max_users", "Users"],
              ["max_workspaces", "Workspaces"],
              ["max_brands", "Brands"],
              ["storage_limit_bytes", "Storage bytes"],
              ["bandwidth_limit_bytes", "Bandwidth bytes"],
              ["scheduled_posts_per_month", "Scheduled posts"],
              ["social_connections", "Social connections"],
              ["can_use_video_generation", "Video generation"],
              ["can_use_premium_video", "Premium video"],
              ["can_use_advanced_analytics", "Advanced analytics"],
              ["can_use_client_workspaces", "Client workspaces"],
              ["can_use_priority_support", "Priority support"],
            ].map(([key, label]) => (
              <label key={key} className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {label}
                <input
                  name={key}
                  defaultValue={String(plan.entitlements[key] ?? "")}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </label>
            ))}
          </div>
        </AdminMutationForm>

        <div className="space-y-4">
          <AdminMutationForm
            action={publishPlanAction}
            title={plan.is_public ? "Unpublish plan" : "Publish plan"}
            description="Stripe checkout remains deferred; this only changes public visibility."
            hiddenFields={[
              { name: "planId", value: planId },
              { name: "returnPath", value: `/admin/plans/${planId}` },
              { name: "mode", value: plan.is_public ? "unpublish" : "publish" },
            ]}
            buttonLabel={plan.is_public ? "Unpublish plan" : "Publish plan"}
          />

          <AdminMutationForm
            action={duplicatePlanAction}
            title="Duplicate plan"
            description="Creates a draft copy for edits without mutating referenced plans in place."
            hiddenFields={[
              { name: "planId", value: planId },
              { name: "returnPath", value: `/admin/plans/${planId}` },
            ]}
            buttonLabel="Duplicate plan"
          />

          <AdminMutationForm
            action={archivePlanAction}
            title="Archive plan"
            description="Plans are archived rather than deleted to preserve account references."
            hiddenFields={[
              { name: "planId", value: planId },
              { name: "returnPath", value: `/admin/plans/${planId}` },
            ]}
            buttonLabel="Archive plan"
          />

          <article className="pm-glass rounded-[2rem] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Integration boundary</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Stripe sync remains deferred</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>Monthly price ID: {plan.stripe_monthly_price_id || "Not configured"}</p>
              <p>Annual price ID: {plan.stripe_annual_price_id || "Not configured"}</p>
              <p>Future Stripe synchronization should attach here without changing the admin pricing data model.</p>
            </div>
          </article>

          {Object.keys(plan.entitlements).length === 0 ? (
            <EmptyState title="No entitlements yet" description="This plan does not currently have seeded entitlement rows." />
          ) : null}
        </div>
      </section>
    </div>
  );
}