import { describe, expect, it } from "vitest";
import {
  nextResolveRefreshInMs,
  selectAssetIdsNeedingResolve,
  type ResolvedAssetCacheEntry,
} from "@/features/media/resolve-cache";

describe("media resolve cache", () => {
  it("resolves only missing or expired visible assets", () => {
    const cachedById: Record<string, ResolvedAssetCacheEntry> = {
      fresh: { assetId: "fresh", expiresAt: "2026-08-01T10:10:00.000Z" },
      expired: { assetId: "expired", expiresAt: "2026-08-01T10:00:00.000Z" },
    };

    const needed = selectAssetIdsNeedingResolve({
      visibleAssetIds: ["fresh", "expired", "missing", "inflight"],
      cachedById,
      inflightAssetIds: new Set(["inflight"]),
      nowMs: Date.parse("2026-08-01T10:00:05.000Z"),
    });

    expect(needed).toEqual(["expired", "missing"]);
  });

  it("returns refresh delay until the earliest visible expiration", () => {
    const cachedById: Record<string, ResolvedAssetCacheEntry> = {
      a: { assetId: "a", expiresAt: "2026-08-01T10:10:00.000Z" },
      b: { assetId: "b", expiresAt: "2026-08-01T10:00:30.000Z" },
    };

    const ms = nextResolveRefreshInMs({
      visibleAssetIds: ["a", "b"],
      cachedById,
      nowMs: Date.parse("2026-08-01T10:00:00.000Z"),
    });

    expect(ms).toBe(30_025);
  });

  it("requests immediate refresh when a visible url is already expired", () => {
    const ms = nextResolveRefreshInMs({
      visibleAssetIds: ["x"],
      cachedById: {
        x: { assetId: "x", expiresAt: "2026-08-01T09:59:59.000Z" },
      },
      nowMs: Date.parse("2026-08-01T10:00:00.000Z"),
    });

    expect(ms).toBe(0);
  });
});
