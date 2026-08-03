import { describe, expect, it } from "vitest";
import type { MediaAsset } from "@/features/core/local-os";
import type { VideoProject } from "@/features/core/video-project";
import {
  EXACT_PRODUCT_REQUIRED_MESSAGE,
  applyProductSceneMetadata,
  buildProductAssetChoices,
  deriveSelectedProductAssetFromProject,
  validateProductImageUpload,
} from "@/features/core/product-asset-selector";

function media(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "asset.png",
    type: "image/png",
    size: 1024,
    tags: ["product"],
    createdAt: new Date().toISOString(),
    storagePath: "workspace-1/user-1/asset.png",
    ...overrides,
  };
}

function project(overrides: Partial<VideoProject> = {}): VideoProject {
  const now = new Date().toISOString();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Project",
    channel: "TikTok",
    objective: "Engagement",
    prompt: "Prompt",
    script: "Script",
    caption: "Caption",
    hashtags: [],
    callToAction: "Shop now",
    scenes: [],
    durationSeconds: 8,
    aspectRatio: "9:16",
    voice: "marin",
    voiceDisclosure: true,
    musicMode: "NONE",
    provider: "OPENAI_SORA_TEMPORARY",
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("product asset selector helpers", () => {
  it("shows only approved workspace images by default", () => {
    const choices = buildProductAssetChoices([
      media({
        id: "asset-approved",
        productMetadata: { approvedForGeneration: true },
      }),
      media({
        id: "asset-unapproved",
        productMetadata: { approvedForGeneration: false },
      }),
      media({
        id: "asset-video",
        type: "video/mp4",
      }),
    ]);

    expect(choices.map((item) => item.id)).toEqual(["asset-approved"]);
  });

  it("can include unapproved workspace images for approval workflows", () => {
    const choices = buildProductAssetChoices(
      [
        media({ id: "approved", productMetadata: { approvedForGeneration: true } }),
        media({ id: "unapproved", productMetadata: { approvedForGeneration: false } }),
      ],
      { includeUnapproved: true },
    );

    expect(choices.map((item) => item.id)).toEqual(["approved", "unapproved"]);
  });

  it("rejects unsupported upload types and oversized uploads", () => {
    expect(
      validateProductImageUpload({
        name: "asset.gif",
        type: "image/gif",
        size: 1024,
      } as File),
    ).toContain("PNG, JPEG, and WEBP");

    expect(
      validateProductImageUpload({
        name: "huge.png",
        type: "image/png",
        size: 30 * 1024 * 1024,
      } as File),
    ).toContain("25MB");
  });

  it("persists selected product asset ID and stable storage path into scenes", () => {
    const scenes = applyProductSceneMetadata(
      [
        {
          order: 1,
          seconds: 8,
          visual: "Visual",
          narration: "Narration",
          onScreenText: "Overlay",
        },
      ],
      {
        id: "asset-1",
        name: "asset-1.png",
        storagePath: "workspace-1/user-1/asset-1.png",
        type: "image/png",
        tags: ["product"],
        productMetadata: { approvedForGeneration: true },
      },
      false,
    );

    expect(scenes[0]?.productAssetId).toBe("asset-1");
    expect(scenes[0]?.productAssetStoragePath).toBe("workspace-1/user-1/asset-1.png");
    expect(scenes[0]?.productMode).toBe("EXACT_PRODUCT");
  });

  it("recovers selected product asset from saved project scenes", () => {
    const selected = deriveSelectedProductAssetFromProject(
      project({
        scenes: [
          {
            order: 1,
            seconds: 8,
            visual: "Visual",
            narration: "Narration",
            onScreenText: "Overlay",
            productAssetId: "asset-2",
            productAssetStoragePath: "workspace-1/user-1/asset-2.png",
          },
        ],
      }),
    );

    expect(selected).toEqual({
      assetId: "asset-2",
      storagePath: "workspace-1/user-1/asset-2.png",
    });
  });

  it("uses explicit exact-product instruction text for generation gating", () => {
    expect(EXACT_PRODUCT_REQUIRED_MESSAGE).toBe(
      "Choose or upload an approved product image before generating in Exact Product Mode.",
    );
  });
});
