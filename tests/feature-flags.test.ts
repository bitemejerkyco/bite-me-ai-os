import { describe, expect, it } from "vitest";
import {
  hashToRolloutBucket,
  resolveFeatureFlag,
  type FeatureFlagSnapshot,
} from "@/features/admin/feature-flag-rules";

const snapshot: FeatureFlagSnapshot = {
  key: "advanced_analytics",
  enabled: true,
  rolloutPercentage: 100,
  allowedAccountTypes: ["paid_customer", "enterprise"],
  allowedPlanKeys: ["growth", "pro", "enterprise"],
  metadata: {},
};

describe("feature flag resolution", () => {
  it("applies global emergency disable first", () => {
    expect(
      resolveFeatureFlag({ ...snapshot, metadata: { emergencyDisabled: true } }),
    ).toEqual({ enabled: false, reason: "EMERGENCY_DISABLED" });
  });

  it("applies account override before allowlists", () => {
    expect(
      resolveFeatureFlag(snapshot, {
        accountId: "account-1",
        accountTypeKey: "trial",
        planKey: "starter",
        accountOverride: true,
      }),
    ).toEqual({ enabled: true, reason: "ACCOUNT_OVERRIDE" });
  });

  it("enforces the account-type allowlist", () => {
    expect(
      resolveFeatureFlag(snapshot, {
        accountId: "account-1",
        accountTypeKey: "trial",
        planKey: "growth",
      }),
    ).toEqual({ enabled: false, reason: "ACCOUNT_TYPE_NOT_ALLOWED" });
  });

  it("enforces the plan allowlist", () => {
    expect(
      resolveFeatureFlag(snapshot, {
        accountId: "account-1",
        accountTypeKey: "paid_customer",
        planKey: "starter",
      }),
    ).toEqual({ enabled: false, reason: "PLAN_NOT_ALLOWED" });
  });

  it("uses rollout percentage after allowlists", () => {
    const bucket = hashToRolloutBucket("advanced_analytics:account-rollout");
    const result = resolveFeatureFlag(
      { ...snapshot, rolloutPercentage: bucket },
      {
        accountId: "account-rollout",
        accountTypeKey: "paid_customer",
        planKey: "growth",
      },
    );
    expect(result).toEqual({ enabled: false, reason: "ROLLOUT_DISABLED" });
  });

  it("falls back to the global enabled state when all gates pass", () => {
    expect(
      resolveFeatureFlag(snapshot, {
        accountId: "account-1",
        accountTypeKey: "paid_customer",
        planKey: "growth",
      }),
    ).toEqual({ enabled: true, reason: "ENABLED" });
  });

  it("fails safely for missing flags", () => {
    expect(resolveFeatureFlag(null)).toEqual({
      enabled: false,
      reason: "MISSING_FLAG",
    });
  });
});