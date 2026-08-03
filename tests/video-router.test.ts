import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIDEO_ROUTER_SETTINGS,
  normalizeVideoGenerationMode,
  normalizeVideoRenderTier,
  resolveVideoRouterProfile,
  selectVideoRenderTier,
} from "@/features/core/video-router";

describe("video router", () => {
  it("normalizes routing inputs", () => {
    expect(normalizeVideoGenerationMode("balanced")).toBe("BALANCED");
    expect(normalizeVideoRenderTier("premium")).toBe("PREMIUM");
  });

  it("routes shorter clips to the cheaper profile by default", () => {
    expect(selectVideoRenderTier({ seconds: 9, mode: "AUTO" })).toBe("ECONOMY");
    expect(selectVideoRenderTier({ seconds: 12, mode: "AUTO" })).toBe("BALANCED");
    expect(selectVideoRenderTier({ seconds: 15, mode: "AUTO" })).toBe("ECONOMY");
  });

  it("honors explicit requests and server settings", () => {
    const economyProfile = resolveVideoRouterProfile({ seconds: 9, mode: "AUTO" });
    expect(economyProfile.providerKey).toBe("REPLICATE");
    expect(economyProfile.model).toBe("wan-video/wan-2.2-t2v-fast");

    const balancedProfile = resolveVideoRouterProfile({ seconds: 12, mode: "AUTO" });
    expect(balancedProfile.providerKey).toBe("OPENAI");
    expect(balancedProfile.model).toBe("sora-2-pro");

    const premiumProfile = resolveVideoRouterProfile({
      seconds: 12,
      requestedTier: "premium",
      settings: DEFAULT_VIDEO_ROUTER_SETTINGS,
    });
    expect(premiumProfile.providerKey).toBe("OPENAI");
    expect(premiumProfile.model).toBe("sora-2-pro");

    expect(
      premiumProfile.tier,
    ).toBe("PREMIUM");
  });
});