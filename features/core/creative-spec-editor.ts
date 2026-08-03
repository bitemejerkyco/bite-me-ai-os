import type { CreativeSpec, CreativeTimelineItem, CreativeTrack } from "@/features/core/creative-spec";

function cloneSpec(spec: CreativeSpec): CreativeSpec {
  return {
    ...spec,
    tracks: spec.tracks.map((track) => ({ ...track })),
    timelineItems: spec.timelineItems.map((item) => ({ ...item, position: { ...item.position }, style: item.style ? { ...item.style } : undefined })),
    scenes: spec.scenes.map((scene) => ({ ...scene })),
    hashtags: [...spec.hashtags],
    productAssetIds: [...spec.productAssetIds],
  };
}

export function orderTracks(spec: CreativeSpec): CreativeTrack[] {
  const byTypeOrder = new Map<string, number>([
    ["VIDEO", 1],
    ["IMAGE", 2],
    ["PRODUCT", 3],
    ["TEXT", 4],
    ["CAPTION", 5],
    ["VOICEOVER", 6],
    ["AUDIO", 7],
    ["MUSIC", 8],
    ["SOUND_EFFECT", 9],
  ]);

  return spec.tracks
    .slice()
    .sort((a, b) => {
      const aOrder = byTypeOrder.get(a.type) || 99;
      const bOrder = byTypeOrder.get(b.type) || 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.label.localeCompare(b.label);
    });
}

export function timelineItemsForTrack(spec: CreativeSpec, trackId: string): CreativeTimelineItem[] {
  return spec.timelineItems
    .filter((item) => item.trackId === trackId)
    .sort((a, b) => a.startFrame - b.startFrame || a.zIndex - b.zIndex);
}

export function duplicateTimelineItem(spec: CreativeSpec, itemId: string): CreativeSpec {
  const existing = spec.timelineItems.find((item) => item.id === itemId);
  if (!existing) return spec;
  const next = cloneSpec(spec);
  const duplicate: CreativeTimelineItem = {
    ...existing,
    id: `${existing.id}-copy-${Math.random().toString(36).slice(2, 7)}`,
    startFrame: Math.min(spec.durationFrames - 1, existing.startFrame + 6),
    position: { ...existing.position, y: existing.position.y + 24 },
    zIndex: existing.zIndex + 1,
  };
  next.timelineItems.push(duplicate);
  return next;
}

export function deleteTimelineItem(spec: CreativeSpec, itemId: string): CreativeSpec {
  const next = cloneSpec(spec);
  next.timelineItems = next.timelineItems.filter((item) => item.id !== itemId);
  return next;
}

export function trimTimelineItem(spec: CreativeSpec, itemId: string, nextDurationFrames: number): CreativeSpec {
  const safeDuration = Math.max(1, Math.min(spec.durationFrames, Math.round(nextDurationFrames)));
  const next = cloneSpec(spec);
  next.timelineItems = next.timelineItems.map((item) =>
    item.id === itemId
      ? {
          ...item,
          durationFrames: Math.min(safeDuration, spec.durationFrames - item.startFrame),
        }
      : item,
  );
  return next;
}

export function moveTimelineItem(spec: CreativeSpec, itemId: string, nextStartFrame: number): CreativeSpec {
  const next = cloneSpec(spec);
  const bounded = Math.max(0, Math.min(spec.durationFrames - 1, Math.round(nextStartFrame)));
  next.timelineItems = next.timelineItems.map((item) =>
    item.id === itemId
      ? {
          ...item,
          startFrame: Math.min(bounded, Math.max(0, spec.durationFrames - item.durationFrames)),
        }
      : item,
  );
  return next;
}

export function setTrackMuted(spec: CreativeSpec, trackId: string, muted: boolean): CreativeSpec {
  const next = cloneSpec(spec);
  next.tracks = next.tracks.map((track) =>
    track.id === trackId ? { ...track, muted } : track,
  );
  next.timelineItems = next.timelineItems.map((item) =>
    item.trackId === trackId ? { ...item, muted } : item,
  );
  return next;
}

export function setTrackHidden(spec: CreativeSpec, trackId: string, hidden: boolean): CreativeSpec {
  const next = cloneSpec(spec);
  next.tracks = next.tracks.map((track) =>
    track.id === trackId ? { ...track, hidden } : track,
  );
  return next;
}

export function setTrackLocked(spec: CreativeSpec, trackId: string, locked: boolean): CreativeSpec {
  const next = cloneSpec(spec);
  next.tracks = next.tracks.map((track) =>
    track.id === trackId ? { ...track, locked } : track,
  );
  next.timelineItems = next.timelineItems.map((item) =>
    item.trackId === trackId ? { ...item, locked } : item,
  );
  return next;
}

export function orderAudioTimelineItems(spec: CreativeSpec): CreativeTimelineItem[] {
  return spec.timelineItems
    .filter((item) => item.trackType === "AUDIO" || item.trackType === "VOICEOVER" || item.trackType === "MUSIC" || item.trackType === "SOUND_EFFECT")
    .sort((a, b) => a.startFrame - b.startFrame || a.trackType.localeCompare(b.trackType));
}

export type CreativeHistoryState = {
  past: CreativeSpec[];
  present: CreativeSpec;
  future: CreativeSpec[];
};

export function createHistoryState(initial: CreativeSpec): CreativeHistoryState {
  return {
    past: [],
    present: cloneSpec(initial),
    future: [],
  };
}

export function pushHistory(state: CreativeHistoryState, next: CreativeSpec): CreativeHistoryState {
  return {
    past: [...state.past, cloneSpec(state.present)].slice(-40),
    present: cloneSpec(next),
    future: [],
  };
}

export function undoHistory(state: CreativeHistoryState): CreativeHistoryState {
  if (!state.past.length) return state;
  const previous = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: cloneSpec(previous),
    future: [cloneSpec(state.present), ...state.future].slice(0, 40),
  };
}

export function redoHistory(state: CreativeHistoryState): CreativeHistoryState {
  if (!state.future.length) return state;
  const next = state.future[0];
  return {
    past: [...state.past, cloneSpec(state.present)].slice(-40),
    present: cloneSpec(next),
    future: state.future.slice(1),
  };
}
