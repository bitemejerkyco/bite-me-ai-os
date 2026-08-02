import { describe, expect, it } from "vitest";
import { CREATOR_EMPTY_STATES } from "@/features/creators/empty-states";

describe("creator empty states", () => {
  it("contains required empty state copy", () => {
    expect(CREATOR_EMPTY_STATES.dashboard.title).toContain("No creator campaigns yet");
    expect(CREATOR_EMPTY_STATES.discover.description).toContain("Clear filters");
    expect(CREATOR_EMPTY_STATES.pipeline.description).toContain("Save a creator");
    expect(CREATOR_EMPTY_STATES.analytics.title).toContain("Creator analytics will appear");
  });
});
