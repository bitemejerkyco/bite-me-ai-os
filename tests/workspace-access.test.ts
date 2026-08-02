import { describe, expect, it } from "vitest";
import {
  filterRowsForWorkspace,
  rowBelongsToWorkspace,
} from "@/features/media/workspace-access";

describe("workspace scoped media access", () => {
  it("accepts rows from current workspace only", () => {
    expect(rowBelongsToWorkspace("ws_a", "ws_a")).toBe(true);
    expect(rowBelongsToWorkspace("ws_a", "ws_b")).toBe(false);
    expect(rowBelongsToWorkspace("ws_a", null)).toBe(false);
  });

  it("filters out rows from other workspaces", () => {
    const filtered = filterRowsForWorkspace("ws_a", [
      { workspace_id: "ws_a", id: 1 },
      { workspace_id: "ws_b", id: 2 },
      { workspace_id: null, id: 3 },
    ]);

    expect(filtered).toEqual([{ workspace_id: "ws_a", id: 1 }]);
  });
});
