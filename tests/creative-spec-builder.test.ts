import { describe, expect, it } from "vitest";
import { buildCreativeSpecFromVideoProject } from "@/features/core/creative-spec-builder";
import { resolveCreatorTemplate } from "@/features/core/creator-template-catalog";

describe("creative spec builder", () => {
  it("preserves exact-product metadata and deterministic text tracks", () => {
    const template = resolveCreatorTemplate("template-product-reveal");
    const spec = buildCreativeSpecFromVideoProject({
      workspaceId: "workspace-1",
      creationMode: "PRODUCT_DEMO",
      template,
      concept: "Concept",
      project: {
        id: "project-1",
        title: "Video",
        channel: "TikTok",
        objective: "Drive engagement",
        prompt: "prompt",
        script: "voice script",
        caption: "caption",
        hashtags: ["#one"],
        callToAction: "Shop now",
        scenes: [
          {
            order: 1,
            seconds: 12,
            visual: "Visual",
            narration: "Narration",
            onScreenText: "Overlay text",
            productAssetId: "asset-product-1",
            productAssetName: "Product",
            productMode: "EXACT_PRODUCT",
          },
        ],
        durationSeconds: 12,
        aspectRatio: "9:16",
        voice: "marin",
        voiceDisclosure: true,
        musicMode: "GENERATED_AMBIENT",
        provider: "OPENAI_SORA_TEMPORARY",
        routingTier: "PREMIUM",
        status: "READY",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(spec.exactProductMode).toBe(true);
    expect(spec.productAssetIds).toContain("asset-product-1");
    expect(spec.timelineItems.some((item) => item.trackType === "CAPTION")).toBe(true);
    expect(spec.timelineItems.some((item) => item.trackType === "TEXT")).toBe(true);
  });
});
