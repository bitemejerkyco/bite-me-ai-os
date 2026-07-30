import PricingComparison from "@/components/pricing/PricingComparison";
import { loadPublicPricingPlans } from "@/features/billing/pricing";

export default async function PricingPage() {
  const { plans, errorMessage } = await loadPublicPricingPlans();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-8 md:px-8 md:py-12">
      <section className="pm-glass rounded-[2.5rem] p-6 md:p-10">
        {errorMessage ? (
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-900">
            {errorMessage}
          </div>
        ) : null}

        {plans.length > 0 ? (
          <PricingComparison plans={plans} />
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">
              Pricing foundation
            </p>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-900 md:text-5xl">
              Pricing is being prepared
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Plan data is not available yet. The pricing route remains live so
              future Stripe checkout work can attach to a stable, database-backed
              plan model.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}