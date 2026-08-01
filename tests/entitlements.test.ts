import { describe, expect, it } from "vitest";
import {
  DISABLED_ENTITLEMENTS,
  SAFE_DEFAULT_ENTITLEMENTS,
  resolveEffectiveEntitlementsFromSnapshot,
} from "@/features/billing/entitlement-rules";

type Snapshot = Parameters<typeof resolveEffectiveEntitlementsFromSnapshot>[0];

function createSnapshot(
  overrides: Partial<Snapshot> = {},
): Snapshot {
  return {
    id: "workspace-1",
    accountTypeKey: "paid_customer",
    billingStatus: "ACTIVE",
    suspendedAt: null,
    metadata: {},
    planEntitlements: {},
    customEntitlements: {},
    overrides: {},
    ...overrides,
  };
}

describe("entitlement resolution", () => {
  it("uses pricing plan entitlements over safe defaults", () => {
    const resolved = resolveEffectiveEntitlementsFromSnapshot(
      createSnapshot({
        planEntitlements: {
          max_users: 5,
          monthly_ai_credits: 2500,
          can_use_advanced_analytics: true,
        },
      }),
    );

    expect(resolved.max_users).toBe(5);
    expect(resolved.monthly_ai_credits).toBe(2500);
    expect(resolved.can_use_advanced_analytics).toBe(true);
    expect(resolved.max_workspaces).toBe(SAFE_DEFAULT_ENTITLEMENTS.max_workspaces);
  });

  it("applies enterprise or custom account entitlements over the plan", () => {
    const resolved = resolveEffectiveEntitlementsFromSnapshot(
      createSnapshot({
        planEntitlements: {
          max_users: 5,
          can_use_client_workspaces: false,
        },
        customEntitlements: {
          max_users: 40,
          can_use_client_workspaces: true,
        },
      }),
    );

    expect(resolved.max_users).toBe(40);
    expect(resolved.can_use_client_workspaces).toBe(true);
  });

  it("applies custom overrides above plan and account-level entitlements", () => {
    const resolved = resolveEffectiveEntitlementsFromSnapshot(
      createSnapshot({
        planEntitlements: { max_users: 5 },
        customEntitlements: { max_users: 25 },
        overrides: {
          max_users: {
            mode: "custom",
            value: 60,
          },
        },
      }),
    );

    expect(resolved.max_users).toBe(60);
  });

  it("supports unlimited overrides", () => {
    const resolved = resolveEffectiveEntitlementsFromSnapshot(
      createSnapshot({
        overrides: {
          social_connections: {
            mode: "unlimited",
            value: null,
          },
        },
      }),
    );

    expect(resolved.social_connections).toBe("unlimited");
  });

  it("supports disabled overrides", () => {
    const resolved = resolveEffectiveEntitlementsFromSnapshot(
      createSnapshot({
        planEntitlements: {
          can_use_video_generation: true,
          monthly_video_credits: 250,
        },
        overrides: {
          can_use_video_generation: {
            mode: "disabled",
            value: null,
          },
          monthly_video_credits: {
            mode: "disabled",
            value: null,
          },
        },
      }),
    );

    expect(resolved.can_use_video_generation).toBe(false);
    expect(resolved.monthly_video_credits).toBe(0);
  });

  it("falls back to safe defaults when no plan data exists", () => {
    expect(
      resolveEffectiveEntitlementsFromSnapshot(createSnapshot()),
    ).toEqual(SAFE_DEFAULT_ENTITLEMENTS);
  });

  it("disables all access for suspended accounts before lower precedence rules", () => {
    const resolved = resolveEffectiveEntitlementsFromSnapshot(
      createSnapshot({
        accountTypeKey: "suspended",
        suspendedAt: "2026-07-30T00:00:00.000Z",
        planEntitlements: {
          max_users: 999,
          can_use_video_generation: true,
        },
        customEntitlements: {
          can_use_priority_support: true,
        },
        overrides: {
          max_users: {
            mode: "unlimited",
            value: null,
          },
        },
      }),
    );

    expect(resolved).toEqual(DISABLED_ENTITLEMENTS);
  });
});