import { describe, expect, it } from "vitest";
import type { CreativeSpec } from "@/features/core/creative-spec";
import { isOverlayOnlyRerender } from "@/features/core/render-change-detection";

function makeSpec(): CreativeSpec {
  return {
    id: "spec-1",
    workspaceId: "workspace-1",
    projectId: "project-1",
    version: "1.0",
    creationMode: "PRODUCT_DEMO",
    title: "Demo",
    format: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    durationFrames: 300,
    qualityTier: "ECONOMY",
    templateId: "template-pattern-interrupt",
    concept: "Concept",
    objective: "Objective",
    callToAction: "Shop now",
    channel: "TikTok",
    durationSeconds: 10,
    strictTextlessFrames: true,
    scenes: [{ order: 1, seconds: 10, visualDirection: "Visual", narration: "Narration", overlayText: "Overlay" }],
    tracks: [
      { id: "video", type: "VIDEO", label: "Video", hidden: false, locked: false, muted: false },
      { id: "text", type: "TEXT", label: "Text", hidden: false, locked: false, muted: false },
    ],
    timelineItems: [
      {
        id: "video-1",
        trackId: "video",
        trackType: "VIDEO",
        startFrame: 0,
        durationFrames: 300,
        zIndex: 1,
        position: { x: 50, y: 50 },
        scale: 1,
        rotation: 0,
        opacity: 1,
        text: "",
        src: "video-a.mp4",
        assetId: "asset-video",
        animationIn: "FADE",
        animationOut: "FADE",
        locked: false,
        muted: false,
      },
      {
        id: "text-1",
        trackId: "text",
        trackType: "TEXT",
        startFrame: 40,
        durationFrames: 100,
        zIndex: 10,
        position: { x: 50, y: 80 },
        scale: 1,
        rotation: 0,
        opacity: 1,
        text: "Hello",
        animationIn: "TYPEWRITER",
        animationOut: "FADE",
        locked: false,
        muted: false,
      },
    ],
    caption: "Caption",
    hashtags: ["#test"],
    productAssetIds: [],
    exactProductMode: false,
  };
}

describe("render change detection", () => {
  it("returns true for overlay-only text edits", () => {
    const previous = makeSpec();
    const next = makeSpec();
    next.timelineItems = next.timelineItems.map((item) =>
      item.id === "text-1" ? { ...item, text: "Updated text" } : item,
    );

    expect(isOverlayOnlyRerender(previous, next)).toBe(true);
  });

  it("returns false when underlying visual asset changes", () => {
    const previous = makeSpec();
    const next = makeSpec();
    next.timelineItems = next.timelineItems.map((item) =>
      item.id === "video-1" ? { ...item, src: "video-b.mp4" } : item,
    );

    expect(isOverlayOnlyRerender(previous, next)).toBe(false);
  });
});
