import { describe, expect, it } from "vitest";
import type { CreativeSpec } from "@/features/core/creative-spec";
import {
  createHistoryState,
  deleteTimelineItem,
  duplicateTimelineItem,
  moveTimelineItem,
  orderAudioTimelineItems,
  orderTracks,
  pushHistory,
  redoHistory,
  setTrackLocked,
  setTrackMuted,
  timelineItemsForTrack,
  trimTimelineItem,
  undoHistory,
} from "@/features/core/creative-spec-editor";

function sampleSpec(): CreativeSpec {
  return {
    id: "spec-1",
    workspaceId: "workspace-1",
    projectId: "project-1",
    version: "1.0",
    creationMode: "PRODUCT_DEMO",
    title: "Sample",
    format: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    durationFrames: 360,
    qualityTier: "ECONOMY",
    templateId: "template-pattern-interrupt",
    concept: "Concept",
    objective: "Objective",
    callToAction: "Shop now",
    channel: "TikTok",
    durationSeconds: 12,
    strictTextlessFrames: true,
    scenes: [
      { order: 1, seconds: 6, visualDirection: "Visual 1", narration: "Narration 1", overlayText: "Overlay 1" },
      { order: 2, seconds: 6, visualDirection: "Visual 2", narration: "Narration 2", overlayText: "Overlay 2" },
    ],
    tracks: [
      { id: "track-text", type: "TEXT", label: "Text", hidden: false, locked: false, muted: false },
      { id: "track-video", type: "VIDEO", label: "Video", hidden: false, locked: false, muted: false },
      { id: "track-music", type: "MUSIC", label: "Music", hidden: false, locked: false, muted: false },
      { id: "track-caption", type: "CAPTION", label: "Caption", hidden: false, locked: false, muted: false },
    ],
    timelineItems: [
      {
        id: "item-video",
        trackId: "track-video",
        trackType: "VIDEO",
        startFrame: 0,
        durationFrames: 180,
        zIndex: 1,
        position: { x: 50, y: 50 },
        scale: 1,
        rotation: 0,
        opacity: 1,
        text: "",
        src: "video-a.mp4",
        assetId: "asset-video-1",
        animationIn: "FADE",
        animationOut: "FADE",
        locked: false,
        muted: false,
      },
      {
        id: "item-caption",
        trackId: "track-caption",
        trackType: "CAPTION",
        startFrame: 0,
        durationFrames: 180,
        zIndex: 5,
        position: { x: 50, y: 85 },
        scale: 1,
        rotation: 0,
        opacity: 1,
        text: "Caption line",
        animationIn: "WORD_BY_WORD",
        animationOut: "FADE",
        locked: false,
        muted: false,
      },
      {
        id: "item-music",
        trackId: "track-music",
        trackType: "MUSIC",
        startFrame: 0,
        durationFrames: 360,
        zIndex: 0,
        position: { x: 0, y: 0 },
        scale: 1,
        rotation: 0,
        opacity: 1,
        text: "music",
        animationIn: "NONE",
        animationOut: "NONE",
        locked: false,
        muted: false,
      },
    ],
    caption: "Caption",
    hashtags: ["#one"],
    productAssetIds: ["product-1"],
    exactProductMode: true,
  };
}

describe("creative spec editor", () => {
  it("orders tracks by visual and audio priority", () => {
    const ordered = orderTracks(sampleSpec());
    expect(ordered.map((track) => track.type)).toEqual(["VIDEO", "TEXT", "CAPTION", "MUSIC"]);
  });

  it("sorts timeline items per track by time", () => {
    const trackItems = timelineItemsForTrack(sampleSpec(), "track-caption");
    expect(trackItems).toHaveLength(1);
    expect(trackItems[0]?.id).toBe("item-caption");
  });

  it("supports duplicate, move, trim, and delete operations", () => {
    const duplicated = duplicateTimelineItem(sampleSpec(), "item-caption");
    expect(duplicated.timelineItems.length).toBe(4);

    const copy = duplicated.timelineItems.find((item) => item.id !== "item-caption" && item.trackId === "track-caption");
    expect(copy).toBeDefined();

    const moved = moveTimelineItem(duplicated, String(copy?.id || ""), 120);
    const movedItem = moved.timelineItems.find((item) => item.id === copy?.id);
    expect(movedItem?.startFrame).toBe(120);

    const trimmed = trimTimelineItem(moved, String(copy?.id || ""), 45);
    expect(trimmed.timelineItems.find((item) => item.id === copy?.id)?.durationFrames).toBe(45);

    const deleted = deleteTimelineItem(trimmed, String(copy?.id || ""));
    expect(deleted.timelineItems.some((item) => item.id === copy?.id)).toBe(false);
  });

  it("propagates mute and lock controls from track to timeline items", () => {
    const muted = setTrackMuted(sampleSpec(), "track-music", true);
    expect(muted.tracks.find((track) => track.id === "track-music")?.muted).toBe(true);
    expect(muted.timelineItems.find((item) => item.trackId === "track-music")?.muted).toBe(true);

    const locked = setTrackLocked(sampleSpec(), "track-caption", true);
    expect(locked.tracks.find((track) => track.id === "track-caption")?.locked).toBe(true);
    expect(locked.timelineItems.find((item) => item.trackId === "track-caption")?.locked).toBe(true);
  });

  it("orders audio items deterministically for mixing", () => {
    const orderedAudio = orderAudioTimelineItems(sampleSpec());
    expect(orderedAudio.map((item) => item.trackType)).toEqual(["MUSIC"]);
  });

  it("supports undo and redo history", () => {
    const initial = sampleSpec();
    const history = createHistoryState(initial);
    const moved = moveTimelineItem(initial, "item-caption", 120);
    const withMove = pushHistory(history, moved);

    const undone = undoHistory(withMove);
    expect(undone.present.timelineItems.find((item) => item.id === "item-caption")?.startFrame).toBe(0);

    const redone = redoHistory(undone);
    expect(redone.present.timelineItems.find((item) => item.id === "item-caption")?.startFrame).toBe(120);
  });
});
