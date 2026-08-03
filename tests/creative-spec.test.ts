import { describe, expect, it } from "vitest";
import {
  buildTextlessFrameConstraint,
  normalizeCreationMode,
  validateCreativeSpec,
} from "@/features/core/creative-spec";

describe("creative spec validation", () => {
  it("normalizes creation mode values", () => {
    expect(normalizeCreationMode("ugc style")).toBe("UGC_STYLE");
    expect(normalizeCreationMode("before-after")).toBe("BEFORE_AFTER");
    expect(normalizeCreationMode("unknown-mode")).toBe("PRODUCT_DEMO");
  });

  it("accepts a valid creative spec", () => {
    const result = validateCreativeSpec({
      id: "spec-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      creationMode: "PRODUCT_DEMO",
      title: "Trail Product Demo",
      templateId: "template-product-reveal",
      concept: "Show the product in a quick outdoor sequence.",
      objective: "Drive product consideration",
      callToAction: "Shop now",
      channel: "TikTok",
      durationSeconds: 12,
      width: 1080,
      height: 1920,
      fps: 30,
      durationFrames: 360,
      qualityTier: "ECONOMY",
      caption: "Trail-ready fuel.",
      hashtags: ["#trail", "#snack"],
      productAssetIds: ["asset-1"],
      exactProductMode: true,
      strictTextlessFrames: true,
      tracks: [
        { id: "track-video", type: "VIDEO", label: "Video", hidden: false, locked: false, muted: false },
        { id: "track-caption", type: "CAPTION", label: "Caption", hidden: false, locked: false, muted: false },
      ],
      timelineItems: [
        {
          id: "video-1",
          trackId: "track-video",
          trackType: "VIDEO",
          startFrame: 0,
          durationFrames: 360,
          zIndex: 1,
          position: { x: 50, y: 50 },
          scale: 1,
          rotation: 0,
          opacity: 1,
          text: "",
          src: "video.mp4",
          animationIn: "FADE",
          animationOut: "FADE",
          locked: false,
          muted: false,
        },
        {
          id: "caption-1",
          trackId: "track-caption",
          trackType: "CAPTION",
          startFrame: 0,
          durationFrames: 360,
          zIndex: 10,
          position: { x: 50, y: 84 },
          scale: 1,
          rotation: 0,
          opacity: 1,
          text: "Trail ready",
          animationIn: "WORD_BY_WORD",
          animationOut: "FADE",
          locked: false,
          muted: false,
        },
      ],
      scenes: [
        {
          order: 1,
          seconds: 6,
          visualDirection: "Hero shot with product in-hand near natural light.",
          narration: "Start with a clean close-up and frame texture detail.",
          overlayText: "Trail ready",
        },
        {
          order: 2,
          seconds: 6,
          visualDirection: "Wide shot while using the product during motion.",
          narration: "End with confidence and clear usage context.",
          overlayText: "Built for the ride",
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.spec?.durationSeconds).toBe(12);
  });

  it("rejects invalid duration totals and rendered text directions", () => {
    const result = validateCreativeSpec({
      id: "spec-2",
      workspaceId: "workspace-1",
      projectId: "project-2",
      creationMode: "ANIMATED_MEME",
      title: "Meme Test",
      templateId: "template-meme-remix",
      concept: "Create a playful reaction edit.",
      objective: "Drive engagement",
      callToAction: "Tag a friend",
      channel: "TikTok",
      durationSeconds: 10,
      width: 1080,
      height: 1920,
      fps: 30,
      durationFrames: 300,
      qualityTier: "ECONOMY",
      caption: "Caption",
      hashtags: ["#meme"],
      productAssetIds: [],
      exactProductMode: false,
      strictTextlessFrames: true,
      tracks: [
        { id: "track-caption", type: "CAPTION", label: "Caption", hidden: false, locked: false, muted: false },
      ],
      timelineItems: [
        {
          id: "caption-a",
          trackId: "track-caption",
          trackType: "CAPTION",
          startFrame: 0,
          durationFrames: 150,
          zIndex: 10,
          position: { x: 50, y: 85 },
          scale: 1,
          rotation: 0,
          opacity: 1,
          text: "buy now",
          animationIn: "FADE",
          animationOut: "FADE",
          locked: false,
          muted: false,
        },
      ],
      scenes: [
        {
          order: 1,
          seconds: 5,
          visualDirection: "Show a card with big price text on screen.",
          narration: "Setup",
          overlayText: "Wait for it",
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("rendered text"))).toBe(true);
    expect(result.errors.some((error) => error.includes("must total"))).toBe(true);
  });

  it("returns deterministic text rendering constraint", () => {
    const constraint = buildTextlessFrameConstraint();
    expect(constraint).toContain("Do not render words");
    expect(constraint).toContain("deterministic overlay");
  });

  it("flags common spelling mistakes in deterministic overlays", () => {
    const result = validateCreativeSpec({
      id: "spec-3",
      workspaceId: "workspace-1",
      projectId: "project-3",
      creationMode: "PRODUCT_DEMO",
      title: "Spelling Validation",
      templateId: "template-product-reveal",
      concept: "Validate deterministic overlay spelling.",
      objective: "Protect spelling quality",
      callToAction: "Learn more",
      channel: "TikTok",
      durationSeconds: 8,
      width: 1080,
      height: 1920,
      fps: 30,
      durationFrames: 240,
      qualityTier: "ECONOMY",
      caption: "Caption",
      hashtags: ["#quality"],
      productAssetIds: [],
      exactProductMode: false,
      strictTextlessFrames: true,
      tracks: [
        { id: "track-video", type: "VIDEO", label: "Video", hidden: false, locked: false, muted: false },
        { id: "track-caption", type: "CAPTION", label: "Caption", hidden: false, locked: false, muted: false },
      ],
      timelineItems: [
        {
          id: "video-1",
          trackId: "track-video",
          trackType: "VIDEO",
          startFrame: 0,
          durationFrames: 240,
          zIndex: 1,
          position: { x: 50, y: 50 },
          scale: 1,
          rotation: 0,
          opacity: 1,
          text: "",
          src: "video.mp4",
          animationIn: "FADE",
          animationOut: "FADE",
          locked: false,
          muted: false,
        },
        {
          id: "caption-1",
          trackId: "track-caption",
          trackType: "CAPTION",
          startFrame: 0,
          durationFrames: 240,
          zIndex: 10,
          position: { x: 50, y: 85 },
          scale: 1,
          rotation: 0,
          opacity: 1,
          text: "Definately trail ready",
          animationIn: "WORD_BY_WORD",
          animationOut: "FADE",
          locked: false,
          muted: false,
        },
      ],
      scenes: [
        {
          order: 1,
          seconds: 8,
          visualDirection: "Hero product shot with clean framing.",
          narration: "Keep this short and clear.",
          overlayText: "Recieve more energy",
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("Possible misspelling"))).toBe(true);
  });
});
