import {
  ENTITLEMENT_KEYS,
  type AccountTypeKey,
  type EntitlementKey,
  type EntitlementScalar,
  type OverrideMode,
} from "@/features/billing/entitlement-rules";

export function buildPlanChange(input: {
  currentPlanId: string | null;
  nextPlanId: string;
}) {
  if (!input.nextPlanId.trim()) {
    throw new Error("PLAN_REQUIRED:A pricing plan is required.");
  }
  return {
    pricing_plan_id: input.nextPlanId,
    previous: { pricing_plan_id: input.currentPlanId },
    next: { pricing_plan_id: input.nextPlanId },
  };
}

export function buildAccountTypeChange(input: {
  currentAccountTypeKey: AccountTypeKey | null;
  nextAccountTypeId: string;
  nextAccountTypeKey: AccountTypeKey;
}) {
  if (!input.nextAccountTypeId.trim()) {
    throw new Error("ACCOUNT_TYPE_REQUIRED:An account type is required.");
  }
  return {
    account_type_id: input.nextAccountTypeId,
    previous: { account_type_key: input.currentAccountTypeKey },
    next: { account_type_key: input.nextAccountTypeKey },
  };
}

export function buildBillingExemptionChange(input: {
  currentBillingExempt: boolean;
  nextBillingExempt: boolean;
}) {
  return {
    billing_exempt: input.nextBillingExempt,
    previous: { billing_exempt: input.currentBillingExempt },
    next: { billing_exempt: input.nextBillingExempt },
  };
}

export function buildSuspensionChange(input: {
  suspendedAt: string | null;
  nextSuspended: boolean;
  reason: string;
}) {
  return input.nextSuspended
    ? {
        suspended_at: new Date().toISOString(),
        billing_status: "SUSPENDED",
        suspension_reason: input.reason,
        previous: { suspended_at: input.suspendedAt, billing_status: null },
        next: {
          suspended_at: "[NOW]",
          billing_status: "SUSPENDED",
          suspension_reason: input.reason,
        },
      }
    : {
        suspended_at: null,
        suspension_reason: null,
        previous: { suspended_at: input.suspendedAt },
        next: {
          suspended_at: null,
          suspension_reason: null,
        },
      };
}

export function buildTrialExpirationChange(nextTrialEndsAt: string) {
  if (!nextTrialEndsAt.trim()) {
    throw new Error("TRIAL_EXPIRATION_REQUIRED:A trial expiration is required.");
  }
  const date = new Date(nextTrialEndsAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error("TRIAL_EXPIRATION_INVALID:Trial expiration must be a valid date.");
  }
  return date.toISOString();
}

export function buildCreditAdjustment(input: {
  currentBalance: number;
  delta: number;
}) {
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    throw new Error("CREDIT_DELTA_INVALID:Credit adjustment must be non-zero.");
  }
  const nextBalance = input.currentBalance + input.delta;
  if (nextBalance < 0) {
    throw new Error("CREDIT_BALANCE_INVALID:Credit balance cannot be negative.");
  }
  return {
    nextBalance,
    delta: input.delta,
  };
}

export function buildEntitlementOverride(input: {
  entitlementKey: EntitlementKey;
  overrideMode: OverrideMode;
  value: EntitlementScalar;
}) {
  if (!ENTITLEMENT_KEYS.includes(input.entitlementKey)) {
    throw new Error("ENTITLEMENT_KEY_INVALID:Unknown entitlement key.");
  }
  if (![
    "use_plan",
    "custom",
    "unlimited",
    "disabled",
  ].includes(input.overrideMode)) {
    throw new Error("ENTITLEMENT_OVERRIDE_INVALID:Unknown override mode.");
  }
  if (input.overrideMode === "custom" && input.value === null) {
    throw new Error(
      "ENTITLEMENT_OVERRIDE_VALUE_REQUIRED:Custom overrides require a value.",
    );
  }
  return {
    entitlement_key: input.entitlementKey,
    override_mode: input.overrideMode,
    value:
      input.overrideMode === "custom"
        ? input.value
        : input.overrideMode === "use_plan"
          ? null
          : input.overrideMode === "unlimited"
            ? "unlimited"
            : 0,
  };
}