import { describe, expect, it } from "vitest";
import {
  matchesSourceFilter,
  matchesTypeFilter,
  sourceBadge,
} from "@/features/media/media-library-filters";

describe("media library filters", () => {
  it("maps source to customer-facing badge labels", () => {
    expect(sourceBadge("UPLOADED")).toBe("Uploaded");
    expect(sourceBadge("GENERATED")).toBe("AI Generated");
    expect(sourceBadge("IMPORTED")).toBe("Imported");
    expect(sourceBadge("UGC")).toBe("UGC");
    expect(sourceBadge("CAMPAIGN")).toBe("Campaign");
  });

  it("supports asset type filters", () => {
    expect(matchesTypeFilter("image", "IMAGE")).toBe(true);
    expect(matchesTypeFilter("video", "VIDEO")).toBe(true);
    expect(matchesTypeFilter("audio", "AUDIO")).toBe(true);
    expect(matchesTypeFilter("document", "DOCUMENT")).toBe(true);
    expect(matchesTypeFilter("file", "DOCUMENT")).toBe(true);
    expect(matchesTypeFilter("video", "IMAGE")).toBe(false);
  });

  it("supports source filters", () => {
    expect(matchesSourceFilter("GENERATED", "GENERATED")).toBe(true);
    expect(matchesSourceFilter(undefined, "UPLOADED")).toBe(true);
    expect(matchesSourceFilter("IMPORTED", "UGC")).toBe(false);
  });
});
