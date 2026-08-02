import { describe, expect, it } from "vitest";
import { buildCreatorDemoData } from "@/features/creators/demo-data";

describe("creator demo data labeling", () => {
  it("keeps revenue and roi unset in demo analytics measured payload", () => {
    const data = buildCreatorDemoData("ws_1", "user_1");
    const snapshot = data.analytics[0];
    expect(snapshot.isDemo).toBe(true);
    expect(snapshot.measured.revenue).toBeNull();
    expect(snapshot.measured.creatorRoi).toBeNull();
  });
});
