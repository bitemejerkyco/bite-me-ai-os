import { describe, expect, it } from "vitest";
import { inferHelpRouteFromQuestion } from "@/features/help/question-routing";

describe("help assistant route inference", () => {
  it("routes TikTok questions to TikTok settings", () => {
    expect(inferHelpRouteFromQuestion("How do I connect TikTok?")).toBe("/settings/integrations/tiktok");
  });

  it("routes publish blockers to publishing queue", () => {
    expect(inferHelpRouteFromQuestion("Why can't I publish?")).toBe("/publishing-queue");
  });

  it("routes product questions to products guidance", () => {
    expect(inferHelpRouteFromQuestion("Where do I add products?")).toBe("/products");
  });
});
