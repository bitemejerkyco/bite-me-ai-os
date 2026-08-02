import { describe, expect, it } from "vitest";
import { SIDEBAR_GROUPS, activeGroupIds } from "@/features/navigation/sidebar-config";

describe("creator sidebar navigation", () => {
  it("adds creator hub routes to sidebar config", () => {
    const creatorGroup = SIDEBAR_GROUPS.find((group) => group.id === "creators");
    expect(creatorGroup).toBeTruthy();

    const hrefs = creatorGroup?.links.map((item) => item.href) || [];
    [
      "/creators",
      "/creators/discover",
      "/creators/pipeline",
      "/creators/campaigns",
      "/creators/content-review",
      "/creators/ugc",
      "/creators/analytics",
    ].forEach((href) => expect(hrefs).toContain(href));
  });

  it("marks creator group active on creator routes", () => {
    expect(activeGroupIds("/creators")).toContain("creators");
    expect(activeGroupIds("/creators/pipeline")).toContain("creators");
  });
});
