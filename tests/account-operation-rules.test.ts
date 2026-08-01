import { describe, expect, it } from "vitest";
import {
  buildAccountTypeChange,
  buildBillingExemptionChange,
  buildCreditAdjustment,
  buildEntitlementOverride,
  buildPlanChange,
  buildSuspensionChange,
  buildTrialExpirationChange,
} from "@/features/admin/account-operation-rules";

describe("account operations", () => {
  it("builds plan changes", () => {
    expect(
      buildPlanChange({ currentPlanId: "plan-1", nextPlanId: "plan-2" }),
    ).toMatchObject({ pricing_plan_id: "plan-2" });
  });

  it("builds account type changes", () => {
    expect(
      buildAccountTypeChange({
        currentAccountTypeKey: "trial",
        nextAccountTypeId: "type-2",
        nextAccountTypeKey: "paid_customer",
      }),
    ).toMatchObject({ account_type_id: "type-2" });
  });

  it("toggles billing exemption safely", () => {
    expect(
      buildBillingExemptionChange({ currentBillingExempt: false, nextBillingExempt: true }),
    ).toEqual({
      billing_exempt: true,
      previous: { billing_exempt: false },
      next: { billing_exempt: true },
    });
  });

  it("builds suspension and reactivation changes", () => {
    expect(
      buildSuspensionChange({ suspendedAt: null, nextSuspended: true, reason: "Fraud review" }).billing_status,
    ).toBe("SUSPENDED");
    expect(
      buildSuspensionChange({ suspendedAt: "2026-07-30T00:00:00.000Z", nextSuspended: false, reason: "Resolved" }).suspended_at,
    ).toBeNull();
  });

  it("validates trial expiration", () => {
    expect(buildTrialExpirationChange("2026-08-15T00:00:00.000Z")).toContain("2026-08-15");
    expect(() => buildTrialExpirationChange("bad-date")).toThrow("TRIAL_EXPIRATION_INVALID");
  });

  it("adjusts credits and blocks negative balances", () => {
    expect(buildCreditAdjustment({ currentBalance: 100, delta: -10 })).toEqual({
      nextBalance: 90,
      delta: -10,
    });
    expect(() => buildCreditAdjustment({ currentBalance: 5, delta: -10 })).toThrow(
      "CREDIT_BALANCE_INVALID",
    );
  });

  it("creates entitlement overrides", () => {
    expect(
      buildEntitlementOverride({
        entitlementKey: "monthly_ai_credits",
        overrideMode: "custom",
        value: 5000,
      }),
    ).toEqual({
      entitlement_key: "monthly_ai_credits",
      override_mode: "custom",
      value: 5000,
    });
  });
});