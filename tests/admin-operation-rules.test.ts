import { describe, expect, it } from "vitest";
import {
  assertCanRemoveSuperAdminAccess,
  requireSensitiveReason,
  requireSuperAdminMutationAccess,
} from "@/features/admin/operation-rules";

describe("admin mutation access", () => {
  it("rejects unauthenticated mutations", () => {
    expect(() =>
      requireSuperAdminMutationAccess({
        actorUserId: null,
        actorIsSuperAdmin: false,
      }),
    ).toThrow("AUTH_REQUIRED");
  });

  it("rejects non-super-admin mutations", () => {
    expect(() =>
      requireSuperAdminMutationAccess({
        actorUserId: "user-1",
        actorIsSuperAdmin: false,
      }),
    ).toThrow("ADMIN_REQUIRED");
  });

  it("allows super-admin mutations", () => {
    expect(() =>
      requireSuperAdminMutationAccess({
        actorUserId: "user-1",
        actorIsSuperAdmin: true,
      }),
    ).not.toThrow();
  });

  it("requires a reason for sensitive changes", () => {
    expect(() => requireSensitiveReason("too short")).not.toThrow();
    expect(() => requireSensitiveReason("short")).toThrow("REASON_REQUIRED");
  });

  it("protects the final super admin from self-removal", () => {
    expect(() =>
      assertCanRemoveSuperAdminAccess({
        actorUserId: "user-1",
        targetUserId: "user-1",
        nextSystemRole: "CUSTOMER",
        activeSuperAdminCount: 1,
      }),
    ).toThrow("LAST_SUPER_ADMIN_PROTECTED");
  });
});