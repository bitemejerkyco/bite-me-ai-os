import { describe, expect, it } from "vitest";
import { inferHelpRouteFromQuestion } from "@/features/help/question-routing";

describe("creator help route inference", () => {
  it("routes creator prompts to creator hub", () => {
    expect(inferHelpRouteFromQuestion("How do I discover creator partners?")).toBe("/creators/discover");
    expect(inferHelpRouteFromQuestion("How do I manage creator outreach?")).toBe("/creators/pipeline");
    expect(inferHelpRouteFromQuestion("How do I check creator ROI?")).toBe("/creators/analytics");
  });
});
