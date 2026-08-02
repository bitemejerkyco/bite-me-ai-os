import { describe, expect, it } from "vitest";
import { collectWorkspaceCacheKeys, demoWorkspace, generateContent, workspaceStorageKey } from "@/features/core/local-os";

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

  it("scopes workspace local storage keys by workspace id", () => {
    expect(workspaceStorageKey("bite-me-ai-os:campaigns", "workspace-1")).toBe(
      "bite-me-ai-os:campaigns:workspace-1",
    );
    expect(workspaceStorageKey("bite-me-ai-os:campaigns", null)).toBe(
      "bite-me-ai-os:campaigns",
    );
  });

  it("collects only workspace-related cache keys for logout cleanup", () => {
    const keys = [
      "bite-me-ai-os:workspace",
      "bite-me-ai-os:drafts",
      "bite-me-ai-os:drafts:workspace-1",
      "bite-me-ai-os:campaigns:workspace-2",
      "bite-me-ai-os:media",
      "postmotive:calendar:prefill",
      "postmotive:demo:workspace",
      "postmotive:media:ui-state",
    ];

    const storage = {
      length: keys.length,
      key(index: number) {
        return keys[index] || null;
      },
      removeItem() {
        // Not required for this test.
      },
    };

    expect(collectWorkspaceCacheKeys(storage)).toEqual([
      "bite-me-ai-os:workspace",
      "bite-me-ai-os:drafts",
      "bite-me-ai-os:drafts:workspace-1",
      "bite-me-ai-os:campaigns:workspace-2",
      "bite-me-ai-os:media",
      "postmotive:calendar:prefill",
    ]);
  });
});
