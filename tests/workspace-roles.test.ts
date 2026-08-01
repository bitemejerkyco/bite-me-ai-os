import { describe, expect, it } from "vitest";
import { roleAtLeast } from "@/features/platform/workspace-role-rank";

describe("workspace role ranking", () => {
  it("allows equal and higher roles", () => {
    expect(roleAtLeast("OWNER", "ADMIN")).toBe(true);
    expect(roleAtLeast("ADMIN", "ADMIN")).toBe(true);
    expect(roleAtLeast("MANAGER", "EDITOR")).toBe(true);
  });

  it("rejects lower roles", () => {
    expect(roleAtLeast("VIEWER", "EDITOR")).toBe(false);
    expect(roleAtLeast("GUEST", "ADMIN")).toBe(false);
  });

  it("keeps compatibility with existing legacy roles", () => {
    expect(roleAtLeast("MEMBER", "EDITOR")).toBe(true);
    expect(roleAtLeast("DEMO", "VIEWER")).toBe(false);
    expect(roleAtLeast("SUPER_ADMIN", "OWNER")).toBe(true);
  });
});
