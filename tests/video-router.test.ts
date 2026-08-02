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
    expect(selectVideoRenderTier({ seconds: 15, mode: "AUTO" })).toBe("BALANCED");
  });

  it("honors explicit requests and server settings", () => {
    expect(resolveVideoRouterProfile({ seconds: 9, mode: "AUTO" }).providerKey).toBe("REPLICATE");
    expect(
      resolveVideoRouterProfile({
        seconds: 12,
        requestedTier: "premium",
        settings: DEFAULT_VIDEO_ROUTER_SETTINGS,
      }).tier,
    ).toBe("PREMIUM");
  });
});