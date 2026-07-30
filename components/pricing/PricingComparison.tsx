"use client";

import { useState } from "react";
import type { PublicPricingPlan } from "@/features/billing/pricing";

type BillingPeriod = "monthly" | "annual";

type PricingComparisonProps = {
  plans: PublicPricingPlan[];
};

function formatMoney(cents: number, currency: string): string {
  if (cents <= 0) return "Contact sales";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatBytes(value: unknown): string {
  const size = typeof value === "number" ? value : 0;
  if (size >= 1099511627776) return `${Math.round(size / 1099511627776)} TB`;
  if (size >= 1073741824) return `${Math.round(size / 1073741824)} GB`;
  return `${Math.round(size / 1048576)} MB`;
}

function boolLabel(value: unknown, enabled: string, disabled = "Not included") {
  return value === true ? enabled : disabled;
}

export default function PricingComparison({
  plans,
}: PricingComparisonProps) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">
            Pricing foundation
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-slate-900 md:text-5xl">
            Plans built for operator reality
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
            Draft, data-driven plans loaded from Supabase. Stripe checkout stays
            outside this phase so plan structure and entitlements can evolve
            without shipping billing assumptions into the UI.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-white/90 bg-white/80 p-1 shadow-[0_12px_30px_rgba(76,61,139,0.1)] backdrop-blur-xl">
          {(["monthly", "annual"] as const).map((value) => {
            const active = period === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  active
                    ? "bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-400 text-white shadow-[0_10px_24px_rgba(104,87,245,0.28)]"
                    : "text-slate-600 hover:text-violet-700"
                }`}
              >
                {value === "monthly" ? "Monthly" : "Annual"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        {plans.map((plan) => {
          const priceCents =
            period === "monthly"
              ? plan.monthlyPriceCents
              : plan.annualPriceCents;
          const periodLabel = period === "monthly" ? "/mo" : "/yr";

          return (
            <article
              key={plan.id}
              className="pm-glass rounded-[2rem] border border-white/90 p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">
                    {plan.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                </div>
                <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-700">
                  {String(plan.metadata.status || "draft")}
                </span>
              </div>

              <div className="mt-6">
                <p className="text-4xl font-black tracking-[-0.04em] text-slate-900">
                  {formatMoney(priceCents, plan.currency)}
                  {priceCents > 0 ? (
                    <span className="ml-1 text-sm font-semibold text-slate-500">
                      {periodLabel}
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  TODO: connect Stripe checkout in a later phase after final plan
                  approval.
                </p>
              </div>

              <dl className="mt-6 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <dt>Users</dt>
                  <dd className="font-semibold">{String(plan.entitlements.max_users ?? "-")}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <dt>Workspaces</dt>
                  <dd className="font-semibold">{String(plan.entitlements.max_workspaces ?? "-")}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <dt>Brands</dt>
                  <dd className="font-semibold">{String(plan.entitlements.max_brands ?? "-")}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <dt>AI credits / month</dt>
                  <dd className="font-semibold">{String(plan.entitlements.monthly_ai_credits ?? "-")}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <dt>Video credits / month</dt>
                  <dd className="font-semibold">{String(plan.entitlements.monthly_video_credits ?? "-")}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <dt>Storage</dt>
                  <dd className="font-semibold">{formatBytes(plan.entitlements.storage_limit_bytes)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <dt>Analytics</dt>
                  <dd className="font-semibold">
                    {boolLabel(plan.entitlements.can_use_advanced_analytics, "Advanced")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <dt>Video access</dt>
                  <dd className="font-semibold">
                    {boolLabel(plan.entitlements.can_use_video_generation, "Included")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <dt>Premium video</dt>
                  <dd className="font-semibold">
                    {boolLabel(plan.entitlements.can_use_premium_video, "Included")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Support</dt>
                  <dd className="font-semibold">
                    {boolLabel(plan.entitlements.can_use_priority_support, "Priority", "Standard")}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}