import { DEFAULT_VIDEO_DURATION_SECONDS, type VideoProject } from "@/features/core/video-project";

export { DEFAULT_VIDEO_DURATION_SECONDS };

export const SHORT_FORM_VIDEO_CHANNELS = [
  "TikTok",
  "Instagram Reels",
  "Facebook Reels",
  "YouTube Shorts",
] as const;

export type ShortFormVideoChannel = (typeof SHORT_FORM_VIDEO_CHANNELS)[number];

export type VideoPostChannelOption = {
  value: string;
  label: string;
  kind: "TEXT" | "VIDEO";
};

export const VIDEO_CHANNEL_OPTIONS: VideoPostChannelOption[] = [
  { value: "instagram", label: "Instagram post", kind: "TEXT" },
  { value: "facebook", label: "Facebook post", kind: "TEXT" },
  { value: "tiktok", label: "TikTok", kind: "VIDEO" },
  { value: "instagram-reels", label: "Instagram Reels", kind: "VIDEO" },
  { value: "facebook-reels", label: "Facebook Reels", kind: "VIDEO" },
  { value: "youtube-shorts", label: "YouTube Shorts", kind: "VIDEO" },
  { value: "linkedin", label: "LinkedIn", kind: "TEXT" },
  { value: "email", label: "Email", kind: "TEXT" },
  { value: "sms", label: "SMS", kind: "TEXT" },
  { value: "blog", label: "Blog", kind: "TEXT" },
];

const SHORT_FORM_LABELS = new Set(SHORT_FORM_VIDEO_CHANNELS);

export function isShortFormVideoChannel(value: string): value is VideoProject["channel"] {
  return SHORT_FORM_LABELS.has(value as ShortFormVideoChannel);
}

export function isVideoPostChannel(value: string): boolean {
  return VIDEO_CHANNEL_OPTIONS.some((option) => option.value === value);
}

export function videoPostDurationHint(): string {
  return `${DEFAULT_VIDEO_DURATION_SECONDS} seconds`;
}
