import { describe, expect, it } from "vitest";
import {
  applyArchiveUpdate,
  applyFavoriteUpdate,
} from "@/features/media/media-asset-updates";

const seed = [
  {
    id: "asset_1",
    name: "a.png",
    type: "image/png",
    size: 10,
    tags: [],
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "asset_2",
    name: "b.png",
    type: "image/png",
    size: 12,
    tags: [],
    createdAt: "2026-08-01T00:00:00.000Z",
  },
];

describe("media asset updates", () => {
  it("applies favorite toggle deterministically", () => {
    const updated = applyFavoriteUpdate(seed, "asset_1", true);
    expect(updated.find((item) => item.id === "asset_1")?.isFavorite).toBe(true);
    expect(updated.find((item) => item.id === "asset_2")?.isFavorite).toBeUndefined();
  });

  it("applies archive and restore deterministically", () => {
    const archivedAt = "2026-08-01T01:00:00.000Z";
    const archived = applyArchiveUpdate(seed, "asset_2", archivedAt);
    expect(archived.find((item) => item.id === "asset_2")?.archivedAt).toBe(archivedAt);

    const restored = applyArchiveUpdate(archived, "asset_2", null);
    expect(restored.find((item) => item.id === "asset_2")?.archivedAt).toBeUndefined();
  });
});
