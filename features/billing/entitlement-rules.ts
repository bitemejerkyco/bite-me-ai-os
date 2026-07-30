export const ACCOUNT_TYPE_KEYS = [
  "super_admin",
  "internal_admin",
  "support_admin",
  "demo",
  "trial",
  "paid_customer",
  "enterprise",
  "agency",
  "suspended",
  "legacy",
] as const;

export const PRICING_PLAN_KEYS = [
  "starter",
  "growth",
  "pro",
  "agency",
  "enterprise",
] as const;

export const ENTITLEMENT_KEYS = [
  "max_users",
  "max_workspaces",
  "max_brands",
  "monthly_ai_credits",
  "monthly_video_credits",
  "storage_limit_bytes",
  "bandwidth_limit_bytes",
  "scheduled_posts_per_month",
  "social_connections",
  "can_use_video_generation",
  "can_use_premium_video",
  "can_use_advanced_analytics",
  "can_use_client_workspaces",
  "can_use_priority_support",
] as const;

export type AccountTypeKey = (typeof ACCOUNT_TYPE_KEYS)[number];
export type PricingPlanKey = (typeof PRICING_PLAN_KEYS)[number];
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];
export type EntitlementScalar = number | boolean | "unlimited" | null;
export type EntitlementValue =
  | EntitlementScalar
  | string
  | { [key: string]: EntitlementValue }
  | EntitlementValue[];
export type EffectiveEntitlements = Record<EntitlementKey, EntitlementScalar>;
export type OverrideMode = "use_plan" | "custom" | "unlimited" | "disabled";

export type AccountSnapshot = {
  id: string;
  accountTypeKey: AccountTypeKey | null;
  billingStatus: string;
  suspendedAt: string | null;
  metadata: Record<string, unknown>;
  planEntitlements: Partial<Record<EntitlementKey, EntitlementScalar>>;
  customEntitlements: Partial<Record<EntitlementKey, EntitlementScalar>>;
  overrides: Partial<
    Record<EntitlementKey, { mode: OverrideMode; value: EntitlementScalar }>
  >;
};

export const SAFE_DEFAULT_ENTITLEMENTS: EffectiveEntitlements = {
  max_users: 1,
  max_workspaces: 1,
  max_brands: 1,
  monthly_ai_credits: 500,
  monthly_video_credits: 30,
  storage_limit_bytes: 2147483648,
  bandwidth_limit_bytes: 10737418240,
  scheduled_posts_per_month: 30,
  social_connections: 2,
  can_use_video_generation: false,
  can_use_premium_video: false,
  can_use_advanced_analytics: false,
  can_use_client_workspaces: false,
  can_use_priority_support: false,
};

export const DISABLED_ENTITLEMENTS: EffectiveEntitlements = {
  max_users: 0,
  max_workspaces: 0,
  max_brands: 0,
  monthly_ai_credits: 0,
  monthly_video_credits: 0,
  storage_limit_bytes: 0,
  bandwidth_limit_bytes: 0,
  scheduled_posts_per_month: 0,
  social_connections: 0,
  can_use_video_generation: false,
  can_use_premium_video: false,
  can_use_advanced_analytics: false,
  can_use_client_workspaces: false,
  can_use_priority_support: false,
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function coerceEntitlementScalar(
  value: unknown,
): EntitlementScalar | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null) return null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (normalized === "unlimited") return "unlimited";
    const asNumber = Number(normalized);
    if (Number.isFinite(asNumber)) return asNumber;
  }
  return undefined;
}

export function pickEntitlementMap(
  source: unknown,
): Partial<Record<EntitlementKey, EntitlementScalar>> {
  if (!isRecord(source)) return {};

  const entries = ENTITLEMENT_KEYS.flatMap((key) => {
    const value = coerceEntitlementScalar(source[key]);
    return value === undefined ? [] : [[key, value] as const];
  });

  return Object.fromEntries(entries) as Partial<
    Record<EntitlementKey, EntitlementScalar>
  >;
}

function isGloballyRestricted(snapshot: AccountSnapshot): boolean {
  const metadata = snapshot.metadata;
  const restrictions = isRecord(metadata.restrictions)
    ? metadata.restrictions
    : null;

  return Boolean(
    snapshot.suspendedAt ||
      snapshot.billingStatus === "SUSPENDED" ||
      snapshot.accountTypeKey === "suspended" ||
      metadata.systemDisabled === true ||
      metadata.system_disabled === true ||
      restrictions?.disabled === true,
  );
}

export function resolveEffectiveEntitlementsFromSnapshot(
  snapshot: AccountSnapshot,
): EffectiveEntitlements {
  if (isGloballyRestricted(snapshot)) {
    return { ...DISABLED_ENTITLEMENTS };
  }

  const resolved: EffectiveEntitlements = { ...SAFE_DEFAULT_ENTITLEMENTS };

  for (const key of ENTITLEMENT_KEYS) {
    const planValue = snapshot.planEntitlements[key];
    if (planValue !== undefined) {
      resolved[key] = planValue;
    }

    const customValue = snapshot.customEntitlements[key];
    if (customValue !== undefined) {
      resolved[key] = customValue;
    }

    const override = snapshot.overrides[key];
    if (!override) continue;

    if (override.mode === "custom" && override.value !== undefined) {
      resolved[key] = override.value;
    }
    if (override.mode === "unlimited") {
      resolved[key] = "unlimited";
    }
    if (override.mode === "disabled") {
      resolved[key] = typeof resolved[key] === "boolean" ? false : 0;
    }
  }

  return resolved;
}