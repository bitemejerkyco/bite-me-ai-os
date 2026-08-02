import { describe, expect, it } from "vitest";
import { CREATOR_MIN_ROLE_BY_ACTION } from "@/features/creators/permission-model";
import { roleAtLeast } from "@/features/platform/workspace-role-rank";

describe("creator permissions", () => {
  it("maps creator actions to required roles", () => {
    expect(CREATOR_MIN_ROLE_BY_ACTION.view).toBe("VIEWER");
    expect(CREATOR_MIN_ROLE_BY_ACTION.manage_creators).toBe("MANAGER");
    expect(CREATOR_MIN_ROLE_BY_ACTION.manage_campaigns).toBe("MANAGER");
    expect(CREATOR_MIN_ROLE_BY_ACTION.review_content).toBe("APPROVER");
    expect(CREATOR_MIN_ROLE_BY_ACTION.view_analytics).toBe("VIEWER");
  });

  it("enforces role hierarchy for creator management", () => {
    expect(roleAtLeast("OWNER", CREATOR_MIN_ROLE_BY_ACTION.manage_creators)).toBe(true);
    expect(roleAtLeast("EDITOR", CREATOR_MIN_ROLE_BY_ACTION.manage_creators)).toBe(false);
    expect(roleAtLeast("APPROVER", CREATOR_MIN_ROLE_BY_ACTION.review_content)).toBe(true);
  });
});
