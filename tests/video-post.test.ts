import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIDEO_DURATION_SECONDS,
  VIDEO_CHANNEL_OPTIONS,
  isShortFormVideoChannel,
  videoPostDurationHint,
} from "@/features/core/video-post";

describe("video post helpers", () => {
  it("distinguishes text and short-form video channels", () => {
    expect(isShortFormVideoChannel("TikTok")).toBe(true);
    expect(isShortFormVideoChannel("Instagram Reels")).toBe(true);
    expect(isShortFormVideoChannel("Facebook Reels")).toBe(true);
    expect(isShortFormVideoChannel("Email")).toBe(false);
  });

  it("defaults to a concise short-form duration", () => {
    expect(DEFAULT_VIDEO_DURATION_SECONDS).toBe(12);
    expect(videoPostDurationHint()).toBe("12 seconds");
  });

  it("includes text and video channel options", () => {
    expect(VIDEO_CHANNEL_OPTIONS.some((option) => option.value === "instagram-reels" && option.kind === "VIDEO")).toBe(true);
    expect(VIDEO_CHANNEL_OPTIONS.some((option) => option.value === "email" && option.kind === "TEXT")).toBe(true);
  });
});
