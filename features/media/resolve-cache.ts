import { shouldRefreshSignedUrl } from "@/features/media/media-url-resolver";

export type ResolvedAssetCacheEntry = {
  assetId: string;
  expiresAt: string | null;
};

export function selectAssetIdsNeedingResolve(args: {
  visibleAssetIds: string[];
  cachedById: Record<string, ResolvedAssetCacheEntry | undefined>;
  inflightAssetIds: Set<string>;
  nowMs?: number;
}): string[] {
  const nowMs = args.nowMs ?? Date.now();
  const needed: string[] = [];
  for (const assetId of args.visibleAssetIds) {
    if (args.inflightAssetIds.has(assetId)) continue;
    const cached = args.cachedById[assetId];
    if (!cached || shouldRefreshSignedUrl(cached.expiresAt, nowMs)) {
      needed.push(assetId);
    }
  }
  return needed;
}

export function nextResolveRefreshInMs(args: {
  visibleAssetIds: string[];
  cachedById: Record<string, ResolvedAssetCacheEntry | undefined>;
  nowMs?: number;
}): number | null {
  const nowMs = args.nowMs ?? Date.now();
  let earliestExpiryMs: number | null = null;
  for (const assetId of args.visibleAssetIds) {
    const cached = args.cachedById[assetId];
    if (!cached?.expiresAt) continue;
    const expiryMs = Date.parse(cached.expiresAt);
    if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) {
      return 0;
    }
    if (earliestExpiryMs === null || expiryMs < earliestExpiryMs) {
      earliestExpiryMs = expiryMs;
    }
  }
  if (earliestExpiryMs === null) return null;
  return Math.max(0, earliestExpiryMs - nowMs + 25);
}
