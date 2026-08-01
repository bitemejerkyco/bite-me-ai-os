import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ENTITLEMENT_KEYS,
  coerceEntitlementScalar,
  type EntitlementKey,
} from "@/features/billing/entitlements";

export type PublicPricingPlan = {
  id: string;
  key: string;
  name: string;
  description: string;
  currency: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  metadata: Record<string, unknown>;
  entitlements: Partial<Record<EntitlementKey, ReturnType<typeof coerceEntitlementScalar>>>;
};

function toMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadPublicPricingPlans(): Promise<{
  plans: PublicPricingPlan[];
  errorMessage: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_plans")
    .select(
      "id,key,name,description,monthly_price_cents,annual_price_cents,currency,metadata,sort_order,plan_entitlements(entitlement_key,value)",
    )
    .eq("is_public", true)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return {
      plans: [],
      errorMessage:
        "Pricing plans are temporarily unavailable. Please try again shortly.",
    };
  }

  const plans = (data || []).map((row) => {
    const entitlements = Object.fromEntries(
      (row.plan_entitlements || []).flatMap((entitlementRow) => {
        const key = entitlementRow.entitlement_key as EntitlementKey;
        if (!ENTITLEMENT_KEYS.includes(key)) return [];
        const value = coerceEntitlementScalar(entitlementRow.value);
        return value === undefined ? [] : [[key, value] as const];
      }),
    ) as PublicPricingPlan["entitlements"];

    return {
      id: String(row.id),
      key: String(row.key),
      name: String(row.name),
      description: String(row.description || ""),
      currency: String(row.currency || "USD"),
      monthlyPriceCents: Number(row.monthly_price_cents || 0),
      annualPriceCents: Number(row.annual_price_cents || 0),
      metadata: toMetadata(row.metadata),
      entitlements,
    };
  });

  return {
    plans,
    errorMessage: null,
  };
}