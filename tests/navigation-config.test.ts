import { describe, expect, it } from "vitest";
import { DASHBOARD_NAVIGATION } from "@/config/navigation";

describe("dashboard navigation config", () => {
  it("contains unique ids and hrefs", () => {
    const ids = new Set(DASHBOARD_NAVIGATION.map((item) => item.id));
    const hrefs = new Set(DASHBOARD_NAVIGATION.map((item) => item.href));

    expect(ids.size).toBe(DASHBOARD_NAVIGATION.length);
    expect(hrefs.size).toBe(DASHBOARD_NAVIGATION.length);
  });

  it("keeps mission control route present", () => {
    expect(DASHBOARD_NAVIGATION.some((item) => item.href === "/mission-control")).toBe(true);
  });
});
