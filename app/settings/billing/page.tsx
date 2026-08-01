import Sidebar from "@/components/Sidebar";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { markBillingReviewCompleteAction, openBillingPortalAction, startCheckoutAction } from "@/app/settings/billing/actions";

type SubscriptionRow = {
  plan_key?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
};

type InvoiceRow = {
  stripe_invoice_id?: string | null;
  amount_due_cents?: number | null;
  amount_paid_cents?: number | null;
  status?: string | null;
  hosted_invoice_url?: string | null;
  created_at?: string | null;
};

type BalanceRow = {
  ai_credits_remaining?: number | null;
  video_credits_remaining?: number | null;
  publish_credits_remaining?: number | null;
  analytics_credits_remaining?: number | null;
};

const PLAN_OPTIONS = [
  {
    key: "starter",
    label: "Starter",
    price: "$29/mo",
    summary: "Small team launch plan",
  },
  {
    key: "professional",
    label: "Professional",
    price: "$79/mo",
    summary: "Growth plan with collaboration and automation",
  },
  {
    key: "business",
    label: "Business",
    price: "$199/mo",
    summary: "Scale operations and multi-brand execution",
  },
  {
    key: "enterprise",
    label: "Enterprise",
    price: "$499/mo",
    summary: "SSO, SCIM, custom support and controls",
  },
] as const;

function formatMoney(cents: number | null | undefined): string {
  const amount = Number(cents || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

export default async function BillingSettingsPage() {
  const context = await requireWorkspaceContext();
  const { supabase, workspaceId } = context;

  const [{ data: subscriptionData }, { data: invoiceData }, { data: balanceData }, { data: onboardingData }] = await Promise.all([
    supabase
      .from("stripe_subscriptions")
      .select("plan_key,status,current_period_end,cancel_at_period_end")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("billing_invoices")
      .select("stripe_invoice_id,amount_due_cents,amount_paid_cents,status,hosted_invoice_url,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("workspace_credit_balances")
      .select("ai_credits_remaining,video_credits_remaining,publish_credits_remaining,analytics_credits_remaining")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("workspace_onboarding_steps")
      .select("step_key,completed")
      .eq("workspace_id", workspaceId)
      .eq("step_key", "billing_review")
      .maybeSingle(),
  ]);

  const subscription = (subscriptionData as SubscriptionRow | null) || null;
  const invoices = (invoiceData as InvoiceRow[] | null) || [];
  const balances = (balanceData as BalanceRow | null) || null;
  const billingReviewComplete = Boolean((onboardingData as { completed?: boolean } | null)?.completed);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 md:flex-row">
      <Sidebar />
      <div className="flex-1 p-5 md:p-10">
        <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Billing</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Subscription, invoices, and credits</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Manage plan lifecycle, open the Stripe customer portal, and review workspace credit balances without changing existing workflows.
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current plan</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{subscription?.plan_key || "trial"}</p>
            <p className="mt-1 text-sm text-slate-600">Status: {subscription?.status || "inactive"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">AI credits</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{String(balances?.ai_credits_remaining || 0)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Video credits</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{String(balances?.video_credits_remaining || 0)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Publish/analytics credits</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {String(balances?.publish_credits_remaining || 0)} / {String(balances?.analytics_credits_remaining || 0)}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-slate-200/90 bg-white/90 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900">Plan upgrade</h2>
              <p className="mt-1 text-sm text-slate-600">Select a plan and continue to secure Stripe checkout.</p>
            </div>
            <form action={openBillingPortalAction}>
              <button type="submit" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
                Open billing portal
              </button>
            </form>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {PLAN_OPTIONS.map((plan) => (
              <form key={plan.key} action={startCheckoutAction} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <input type="hidden" name="planKey" value={plan.key} />
                <p className="text-sm font-semibold text-slate-900">{plan.label}</p>
                <p className="mt-1 text-xs text-slate-500">{plan.summary}</p>
                <p className="mt-2 text-lg font-black text-violet-700">{plan.price}</p>
                <button type="submit" className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                  Continue with Stripe
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-slate-200/90 bg-white/90 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black tracking-tight text-slate-900">Recent invoices</h2>
            <form action={markBillingReviewCompleteAction}>
              <button type="submit" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
                {billingReviewComplete ? "Checklist marked complete" : "Mark billing review complete"}
              </button>
            </form>
          </div>
          {invoices.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No invoices have been synced yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Paid</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice, index) => (
                    <tr key={`${invoice.stripe_invoice_id || "invoice"}-${index}`} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{invoice.stripe_invoice_id || "-"}</td>
                      <td className="px-3 py-3 text-slate-700">{invoice.status || "unknown"}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(invoice.amount_due_cents)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(invoice.amount_paid_cents)}</td>
                      <td className="px-3 py-3 text-slate-700">{invoice.created_at ? new Date(invoice.created_at).toLocaleString() : "-"}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {invoice.hosted_invoice_url ? (
                          <a href={invoice.hosted_invoice_url} className="font-semibold text-violet-700 hover:text-violet-600" target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
