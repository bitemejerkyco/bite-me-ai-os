export function isBriefRefreshThrottled(input: {
  lastUpdatedAt: string | null;
  now?: number;
  minIntervalMs: number;
}): boolean {
  if (!input.lastUpdatedAt) return false;
  const updatedAtMs = new Date(input.lastUpdatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return false;
  const now = typeof input.now === "number" ? input.now : Date.now();
  return now - updatedAtMs < input.minIntervalMs;
}
