import { describe, expect, it } from "vitest";
import {
  extractFileNameFromDisposition,
  isLikelyExpiredSignedUrlFailure,
} from "@/features/media/download-utils";

describe("media download utils", () => {
  it("extracts filename from standard disposition", () => {
    expect(
      extractFileNameFromDisposition('attachment; filename="postmotive-mark.png"'),
    ).toBe("postmotive-mark.png");
  });

  it("extracts filename from utf-8 disposition", () => {
    expect(
      extractFileNameFromDisposition("attachment; filename*=UTF-8''Off-Road-On-Snack-.mp4"),
    ).toBe("Off-Road-On-Snack-.mp4");
  });

  it("retries only on auth-like expiration responses", () => {
    expect(isLikelyExpiredSignedUrlFailure(403, "token expired")).toBe(true);
    expect(isLikelyExpiredSignedUrlFailure(401, "signature invalid")).toBe(true);
    expect(isLikelyExpiredSignedUrlFailure(404, "missing")).toBe(false);
    expect(isLikelyExpiredSignedUrlFailure(403, "storage unavailable")).toBe(false);
  });
});
