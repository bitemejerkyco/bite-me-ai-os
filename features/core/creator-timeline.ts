export const CREATOR_TRACK_TYPES = [
  "VIDEO",
  "VOICEOVER",
  "CAPTION",
  "MUSIC",
  "FX",
  "PRODUCT_OVERLAY",
] as const;

export type CreatorTrackType = (typeof CREATOR_TRACK_TYPES)[number];

export type CreatorTimelineClip = {
  id: string;
  trackType: CreatorTrackType;
  startSeconds: number;
  durationSeconds: number;
  label: string;
  content: string;
};

export type CreatorTimeline = {
  durationSeconds: number;
  tracks: Array<{
    type: CreatorTrackType;
    clips: CreatorTimelineClip[];
  }>;
};

export function createEmptyTimeline(durationSeconds: number): CreatorTimeline {
  return {
    durationSeconds,
    tracks: CREATOR_TRACK_TYPES.map((type) => ({ type, clips: [] })),
  };
}

export function createMemeStarterTimeline(durationSeconds: number): CreatorTimeline {
  return {
    durationSeconds,
    tracks: [
      {
        type: "VIDEO",
        clips: [
          {
            id: "meme-shot-1",
            trackType: "VIDEO",
            startSeconds: 0,
            durationSeconds,
            label: "Reaction shot",
            content: "One-shot reaction framing for meme mode.",
          },
        ],
      },
      {
        type: "CAPTION",
        clips: [
          {
            id: "meme-caption-1",
            trackType: "CAPTION",
            startSeconds: 0,
            durationSeconds: Math.max(2, Math.floor(durationSeconds / 2)),
            label: "Setup line",
            content: "Top caption setup",
          },
          {
            id: "meme-caption-2",
            trackType: "CAPTION",
            startSeconds: Math.max(2, Math.floor(durationSeconds / 2)),
            durationSeconds: Math.max(2, durationSeconds - Math.max(2, Math.floor(durationSeconds / 2))),
            label: "Punchline line",
            content: "Bottom caption punchline",
          },
        ],
      },
      {
        type: "MUSIC",
        clips: [
          {
            id: "meme-music-1",
            trackType: "MUSIC",
            startSeconds: 0,
            durationSeconds,
            label: "Loop bed",
            content: "Light rhythmic loop",
          },
        ],
      },
      {
        type: "VOICEOVER",
        clips: [],
      },
      {
        type: "FX",
        clips: [],
      },
      {
        type: "PRODUCT_OVERLAY",
        clips: [],
      },
    ],
  };
}
