import { describe, expect, it } from "vitest";
import { demoWorkspace, generateContent } from "@/features/core/local-os";

describe("local operational core", () => {
  it("generates brand-specific standard content", () => {
    const result = generateContent({
      workspace: demoWorkspace(),
      channel: "email",
      objective: "Generate sales",
      offer: "free shipping over $75",
      callToAction: "Shop the collection",
    });
    expect(result.copy).toContain("Bite Me Jerky");
    expect(result.copy).toContain("free shipping over $75");
    expect(result.copy).toContain("Shop the collection");
  });

  it("applies restricted-industry compliance guidance", () => {
    const result = generateContent({
      workspace: { ...demoWorkspace(), industry: "CANNABIS" },
      channel: "instagram",
      objective: "Build trust",
      offer: "behind-the-scenes brand story",
      callToAction: "Learn more",
    });
    expect(result.copy).toContain("quality, transparency, and community");
    expect(result.complianceNote).toContain("Compliance Mode applied");
    expect(result.complianceNote).toContain("restricted product promotion");
  });

  it("generates TikTok-specific content", () => {
    const result = generateContent({
      workspace: demoWorkspace(),
      channel: "tiktok",
      objective: "Drive engagement",
      offer: "a behind-the-scenes jerky-making video",
      callToAction: "Follow for more",
    });
    expect(result.title).toContain("TikTok");
    expect(result.copy).toContain("behind-the-scenes jerky-making video");
  });
});
