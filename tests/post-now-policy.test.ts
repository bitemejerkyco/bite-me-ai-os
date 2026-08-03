import { describe, expect, it } from "vitest";
import { hasDuplicatePublish, isPostNowEligible } from "@/features/core/post-now-policy";

describe("post now policy", () => {
  it("allows only approved items with completed media", () => {
    expect(isPostNowEligible({ videoProjectId: "p1", status: "APPROVED", videoStoragePath: "videos/p1.mp4" })).toBe(true);
    expect(isPostNowEligible({ videoProjectId: "p1", status: "READY", videoStoragePath: "videos/p1.mp4" })).toBe(false);
    expect(isPostNowEligible({ videoProjectId: "p1", status: "APPROVED", videoStoragePath: null })).toBe(false);
  });

  it("detects duplicate publish scenarios", () => {
    const existing = [
      { videoProjectId: "p1", status: "PUBLISHED" },
      { videoProjectId: "p2", status: "FAILED" },
    ];
    expect(hasDuplicatePublish(existing, "p1")).toBe(true);
    expect(hasDuplicatePublish(existing, "p2")).toBe(false);
  });
});
