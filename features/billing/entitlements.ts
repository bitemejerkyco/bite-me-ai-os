import "server-only";

import { assertCurrentUserCanAccessAccount } from "@/lib/auth/server";
import {
  ENTITLEMENT_KEYS,
  SAFE_DEFAULT_ENTITLEMENTS,
  DISABLED_ENTITLEMENTS,
  coerceEntitlementScalar,
  isRecord,
  pickEntitlementMap,
  resolveEffectiveEntitlementsFromSnapshot,
  type AccountSnapshot,
  type AccountTypeKey,
  type EffectiveEntitlements,
  type EntitlementKey,
  type EntitlementScalar,
  type EntitlementValue,
  type OverrideMode,
  type PricingPlanKey,
} from "@/features/billing/entitlement-rules";
import { createAdminClient } from "@/lib/supabase/admin";

type WorkspaceAccountRow = {
  id: string;
  account_type_id: string | null;
  pricing_plan_id: string | null;
  billing_status: string | null;
  suspended_at: string | null;
  metadata: unknown;
};

type AccountTypeRow = {
  key: string;
};

type PlanEntitlementRow = {
  entitlement_key: string;
  value: unknown;
};

type AccountOverrideRow = {
  entitlement_key: string;
  override_mode: OverrideMode;
  value: unknown;
};

export type {
  AccountSnapshot,
  AccountTypeKey,
  EffectiveEntitlements,
  EntitlementKey,
  EntitlementScalar,
  EntitlementValue,
  OverrideMode,
  PricingPlanKey,
};
export {
  DISABLED_ENTITLEMENTS,
  ENTITLEMENT_KEYS,
  SAFE_DEFAULT_ENTITLEMENTS,
  coerceEntitlementScalar,
  resolveEffectiveEntitlementsFromSnapshot,
};

async function loadAccountSnapshot(accountId: string): Promise<AccountSnapshot> {
  const admin = createAdminClient();

  const workspaceResult = await admin
    .from("workspaces")
    .select(
      "id,account_type_id,pricing_plan_id,billing_status,suspended_at,metadata",
    )
    .eq("id", accountId)
    .maybeSingle();

  const workspace = workspaceResult.data as WorkspaceAccountRow | null;
  const workspaceError = workspaceResult.error;

  if (workspaceError) {
    throw new Error(`ACCOUNT_LOOKUP_FAILED:${workspaceError.message}`);
  }
  if (!workspace?.id) {
    throw new Error("ACCOUNT_NOT_FOUND:Account was not found.");
  }

  const [accountTypeResult, planEntitlementsResult, overridesResult] =
    await Promise.all([
      workspace.account_type_id
        ? admin
            .from("account_types")
            .select("key")
            .eq("id", workspace.account_type_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      workspace.pricing_plan_id
        ? admin
            .from("plan_entitlements")
            .select("entitlement_key,value")
            .eq("plan_id", workspace.pricing_plan_id)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("account_entitlement_overrides")
        .select("entitlement_key,override_mode,value")
        .eq("account_id", workspace.id),
    ]);

  const accountType = accountTypeResult.data as AccountTypeRow | null;
  const planEntitlements =
    (planEntitlementsResult.data as PlanEntitlementRow[] | null) || [];
  const accountOverrides =
    (overridesResult.data as AccountOverrideRow[] | null) || [];

  if (accountTypeResult.error) {
    throw new Error(`ACCOUNT_TYPE_LOOKUP_FAILED:${accountTypeResult.error.message}`);
  }
  if (planEntitlementsResult.error) {
    throw new Error(
      `PLAN_ENTITLEMENTS_LOOKUP_FAILED:${planEntitlementsResult.error.message}`,
    );
  }
  if (overridesResult.error) {
    throw new Error(`ACCOUNT_OVERRIDE_LOOKUP_FAILED:${overridesResult.error.message}`);
  }

  const metadata = isRecord(workspace.metadata) ? workspace.metadata : {};

  return {
    id: workspace.id,
    accountTypeKey: (accountType?.key as AccountTypeKey | undefined) ?? null,
    billingStatus: String(workspace.billing_status || "UNCONFIGURED"),
    suspendedAt: workspace.suspended_at ? String(workspace.suspended_at) : null,
    metadata,
    customEntitlements: pickEntitlementMap(metadata.entitlements),
    planEntitlements: Object.fromEntries(
      planEntitlements.flatMap((row) => {
        const key = row.entitlement_key as EntitlementKey;
        const value = coerceEntitlementScalar(row.value);
        return value === undefined ? [] : [[key, value] as const];
      }),
    ) as Partial<Record<EntitlementKey, EntitlementScalar>>,
    overrides: Object.fromEntries(
      accountOverrides.flatMap((row) => {
        const key = row.entitlement_key as EntitlementKey;
        const value = coerceEntitlementScalar(row.value);
        return [
          [
            key,
            {
              mode: row.override_mode as OverrideMode,
              value: value ?? null,
            },
          ] as const,
        ];
      }),
    ) as Partial<
      Record<EntitlementKey, { mode: OverrideMode; value: EntitlementScalar }>
    >,
  };
}

export async function getEffectiveEntitlements(
  accountId: string,
): Promise<EffectiveEntitlements> {
  await assertCurrentUserCanAccessAccount(accountId);
  return resolveEffectiveEntitlementsFromSnapshot(
    await loadAccountSnapshot(accountId),
  );
}

export async function getEffectiveEntitlement(
  accountId: string,
  entitlementKey: EntitlementKey,
): Promise<EntitlementScalar> {
  const entitlements = await getEffectiveEntitlements(accountId);
  return entitlements[entitlementKey];
}

export async function canUseFeature(
  accountId: string,
  entitlementKey: EntitlementKey,
): Promise<boolean> {
  const value = await getEffectiveEntitlement(accountId, entitlementKey);

  if (value === "unlimited") return true;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  return false;
}

export async function enforceEntitlement(
  accountId: string,
  entitlementKey: EntitlementKey,
): Promise<void> {
  if (!(await canUseFeature(accountId, entitlementKey))) {
    throw new Error(
      `ENTITLEMENT_DENIED:${entitlementKey} is not available for this account.`,
    );
  }
}