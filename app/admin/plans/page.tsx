import Link from "next/link";
import AdminMutationForm from "@/components/admin/AdminMutationForm";
import AdminNotice from "@/components/admin/AdminNotice";
import AdminTable from "@/components/admin/AdminTable";
import EmptyState from "@/components/admin/EmptyState";
import {
  createPlanAction,
  reorderPlanAction,
} from "@/app/admin/actions";
import { listAdminPlans } from "@/features/admin/console";

export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  const plans = await listAdminPlans();

  return (
    <div className="space-y-6">
      <AdminNotice notice={query.notice} error={query.error} />

      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">
          Plans & Pricing
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Pricing plan editor
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Manage draft, public, active, and archived plans while keeping Stripe sync outside this phase.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminTable
          headers={[
            "Plan",
            "State",
            "Monthly",
            "Annual",
            "Currency",
            "Public",
            "Active",
            "Sort order",
            "Stripe IDs",
            "Entitlements",
          ]}
          emptyState={plans.length === 0 ? <EmptyState title="No plans found" description="Create your first pricing plan to begin Phase 2 pricing operations." /> : undefined}
        >
          {plans.map((plan) => (
            <tr key={plan.id} className="align-top">
              <td className="px-4 py-4">
                <Link className="font-semibold text-violet-700 underline" href={`/admin/plans/${plan.id}`}>
                  {plan.name}
                </Link>
                <p className="mt-1 text-xs text-slate-500">{plan.key}</p>
              </td>
              <td className="px-4 py-4">{plan.lifecycle_state}</td>
              <td className="px-4 py-4">{plan.monthly_price_cents / 100}</td>
              <td className="px-4 py-4">{plan.annual_price_cents / 100}</td>
              <td className="px-4 py-4">{plan.currency}</td>
              <td className="px-4 py-4">{plan.is_public ? "Yes" : "No"}</td>
              <td className="px-4 py-4">{plan.is_active ? "Yes" : "No"}</td>
              <td className="px-4 py-4">{plan.sort_order}</td>
              <td className="px-4 py-4 text-xs text-slate-500">
                <p>{plan.stripe_monthly_price_id || "Monthly pending"}</p>
                <p>{plan.stripe_annual_price_id || "Annual pending"}</p>
              </td>
              <td className="px-4 py-4">{Object.keys(plan.entitlements).length}</td>
            </tr>
          ))}
        </AdminTable>

        <div className="space-y-4">
          <AdminMutationForm
            action={createPlanAction}
            title="Create plan"
            description="Creates a new draft pricing plan."
            hiddenFields={[{ name: "returnPath", value: "/admin/plans" }]}
            buttonLabel="Create plan"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Name
              <input name="name" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Key
              <input name="key" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Description
              <textarea name="description" className="mt-2 h-24 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Monthly price cents
                <input name="monthlyPriceCents" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" defaultValue="0" />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Annual price cents
                <input name="annualPriceCents" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" defaultValue="0" />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Currency
                <input name="currency" defaultValue="USD" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Sort order
                <input name="sortOrder" defaultValue="0" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
              </label>
            </div>
          </AdminMutationForm>

          {plans.map((plan) => (
            <AdminMutationForm
              key={plan.id}
              action={reorderPlanAction}
              title={`Reorder ${plan.name}`}
              description="Updates the display sort order without changing plan contents."
              hiddenFields={[
                { name: "planId", value: plan.id },
                { name: "returnPath", value: "/admin/plans" },
              ]}
              buttonLabel="Save sort order"
            >
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Sort order
                <input name="sortOrder" defaultValue={String(plan.sort_order)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" />
              </label>
            </AdminMutationForm>
          ))}
        </div>
      </section>
    </div>
  );
}