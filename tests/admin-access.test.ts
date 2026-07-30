import { describe, expect, it } from "vitest";
import {
  resolveAccountAccess,
  resolveAdminAccess,
} from "@/lib/auth/access-rules";

describe("admin route access", () => {
  it("redirects unauthenticated viewers away from admin routes", () => {
    expect(
      resolveAdminAccess({ userId: null, isSuperAdmin: false }),
    ).toEqual({
      allowed: false,
      reason: "UNAUTHENTICATED",
      redirectTo: "/login",
    });
  });

  it("blocks signed-in customers from admin routes", () => {
    expect(
      resolveAdminAccess({ userId: "user-1", isSuperAdmin: false }),
    ).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
      redirectTo: "/",
    });
  });

  it("allows super admins through admin routes", () => {
    expect(
      resolveAdminAccess({ userId: "user-1", isSuperAdmin: true }),
    ).toEqual({
      allowed: true,
      reason: "ALLOWED",
      redirectTo: null,
    });
  });
});

describe("account isolation", () => {
  it("allows a customer to access their own account", () => {
    expect(
      resolveAccountAccess({
        userId: "user-1",
        isSuperAdmin: false,
        belongsToAccount: true,
      }),
    ).toEqual({
      allowed: true,
      reason: "ALLOWED",
      redirectTo: null,
    });
  });

  it("prevents customers from accessing other customer accounts", () => {
    expect(
      resolveAccountAccess({
        userId: "user-1",
        isSuperAdmin: false,
        belongsToAccount: false,
      }),
    ).toEqual({
      allowed: false,
      reason: "FORBIDDEN",
      redirectTo: "/",
    });
  });

  it("allows super admins to cross account boundaries when needed", () => {
    expect(
      resolveAccountAccess({
        userId: "admin-1",
        isSuperAdmin: true,
        belongsToAccount: false,
      }),
    ).toEqual({
      allowed: true,
      reason: "ALLOWED",
      redirectTo: null,
    });
  });
});