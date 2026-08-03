export type PostNowCandidate = {
  videoProjectId: string;
  status: string;
  videoStoragePath: string | null;
};

export type ExistingPublishRecord = {
  videoProjectId: string;
  status: string;
};

const BLOCKING_STATUSES = new Set([
  "SCHEDULED",
  "PUBLISHING",
  "DELIVERED_TO_INBOX",
  "PUBLISHED",
]);

export function isPostNowEligible(candidate: PostNowCandidate): boolean {
  return candidate.status === "APPROVED" && Boolean(candidate.videoStoragePath);
}

export function hasDuplicatePublish(existing: ExistingPublishRecord[], videoProjectId: string): boolean {
  return existing.some(
    (item) => item.videoProjectId === videoProjectId && BLOCKING_STATUSES.has(item.status),
  );
}
