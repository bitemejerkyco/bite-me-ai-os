import { describe, expect, it } from "vitest";
import { hasRequiredRole } from "@/lib/auth/workspace-auth";

describe("workspace role checks", () => {
  it("allows higher roles for lower required permissions", () => {
    expect(hasRequiredRole("OWNER", "VIEWER")).toBe(true);
    expect(hasRequiredRole("ADMIN", "EDITOR")).toBe(true);
  });

  it("rejects lower roles for higher required permissions", () => {
    expect(hasRequiredRole("VIEWER", "EDITOR")).toBe(false);
    expect(hasRequiredRole("EDITOR", "ADMIN")).toBe(false);
  });
});
