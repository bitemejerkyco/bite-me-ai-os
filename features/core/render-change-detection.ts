import type { CreativeSpec, CreativeTimelineItem } from "@/features/core/creative-spec";

function byId(items: CreativeTimelineItem[]): Map<string, CreativeTimelineItem> {
  return new Map(items.map((item) => [item.id, item]));
}

function isOverlayTrackType(trackType: CreativeTimelineItem["trackType"]): boolean {
  return trackType === "TEXT" || trackType === "CAPTION" || trackType === "AUDIO" || trackType === "VOICEOVER" || trackType === "MUSIC" || trackType === "SOUND_EFFECT";
}

export function isOverlayOnlyRerender(previous: CreativeSpec, next: CreativeSpec): boolean {
  if (previous.projectId !== next.projectId || previous.workspaceId !== next.workspaceId) {
    return false;
  }
  const prev = byId(previous.timelineItems);
  const curr = byId(next.timelineItems);

  for (const [id, before] of prev) {
    const after = curr.get(id);
    if (!after) return false;
    if (before.trackType !== after.trackType) return false;

    if (!isOverlayTrackType(before.trackType)) {
      if (
        before.src !== after.src
        || before.assetId !== after.assetId
        || before.startFrame !== after.startFrame
        || before.durationFrames !== after.durationFrames
      ) {
        return false;
      }
    }
  }

  for (const [id, after] of curr) {
    if (!prev.has(id)) {
      if (!isOverlayTrackType(after.trackType)) {
        return false;
      }
    }
  }

  return true;
}
