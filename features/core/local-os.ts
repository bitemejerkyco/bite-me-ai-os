export const STORAGE_KEYS = {
  accountMode: "bite-me-ai-os:account-mode",
  workspace: "bite-me-ai-os:workspace",
  drafts: "bite-me-ai-os:drafts",
  campaigns: "bite-me-ai-os:campaigns",
  media: "bite-me-ai-os:media",
  demoWorkspace: "postmotive:demo:workspace",
  demoDrafts: "postmotive:demo:drafts",
  demoCampaigns: "postmotive:demo:campaigns",
  demoMedia: "postmotive:demo:media",
  demoSchedule: "postmotive:demo:schedule",
  demoFeedback: "postmotive:demo:feedback",
  demoPerformance: "postmotive:demo:performance",
  demoKnowledge: "postmotive:demo:knowledge",
  demoVideos: "postmotive:demo:videos",
  demoFolders: "postmotive:demo:folders",
  calendarPrefill: "postmotive:calendar:prefill",
} as const;

export type AccountMode = "SUPER_ADMIN" | "DEMO";
export type Industry =
  | "GENERAL_RETAIL"
  | "FOOD_BEVERAGE"
  | "CANNABIS"
  | "CBD"
  | "ALCOHOL"
  | "HEALTHCARE"
  | "FINANCIAL_SERVICES"
  | "SUPPLEMENTS";

export type WorkspaceProfile = {
  id?: string;
  businessName: string;
  website: string;
  industry: Industry;
  primaryGoal: string;
  audience: string;
  voice: string;
  completedAt: string;
};

export type ContentDraft = {
  id: string;
  title: string;
  channel: string;
  objective: string;
  copy: string;
  complianceNote: string;
  status: "DRAFT" | "APPROVED";
  createdAt: string;
  entryType?: "POST" | "AD";
  generationRunId?: string;
  originalCopy?: string;
  model?: string;
  promptVersion?: string;
  contentFormat?: "STATIC" | "VERTICAL_VIDEO";
  videoProjectId?: string;
  mediaStoragePath?: string;
  folderId?: string;
};

export type ContentFeedback = {
  id: string;
  draftId?: string;
  generationRunId?: string;
  scheduledPostId?: string;
  signal:
    | "POSITIVE"
    | "NEGATIVE"
    | "EDITED"
    | "APPROVED"
    | "REJECTED"
    | "PUBLISH_SUCCEEDED"
    | "PUBLISH_FAILED";
  reason: string;
  notes: string;
  originalCopy?: string;
  finalCopy?: string;
  entryType: "POST" | "AD";
  channel: string;
  createdAt: string;
};

export type CampaignPlan = {
  id: string;
  name: string;
  objective: string;
  channel: string;
  status: "PLANNED" | "ACTIVE" | "PAUSED";
  startDate: string;
  budget: number;
};

export type MediaAsset = {
  id: string;
  name: string;
  type: string;
  size: number;
  tags: string[];
  createdAt: string;
  storagePath?: string;
  folderId?: string;
  isFavorite?: boolean;
  source?: "UPLOADED" | "GENERATED" | "IMPORTED" | "LEGACY" | "CAMPAIGN" | "UGC";
  generationStatus?: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  generationJobId?: string;
  thumbnailPath?: string;
  posterPath?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  archivedAt?: string;
  productMetadata?: {
    productId?: string;
    productName?: string;
    assetRole?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
    isPrimaryProductImage?: boolean;
    role?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
    angle?: string;
    locked?: boolean;
    approvedForGeneration?: boolean;
    transparentBackground?: boolean;
    originalAssetId?: string;
    exactProductMode?: boolean;
    allowAiMotion?: boolean;
    preserveOriginalAsset?: boolean;
    originalStoragePath?: string;
    background?: string;
    position?: string;
    scale?: string;
    safeArea?: string;
    notes?: string;
  };
};

export type LibraryFolder = {
  id: string;
  libraryType: "CONTENT" | "MEDIA";
  name: string;
  parentId?: string;
  createdAt: string;
};

export type ScheduledPost = {
  id: string;
  entryType: "POST" | "AD";
  channel:
    | "TikTok"
    | "Instagram"
    | "Facebook"
    | "LinkedIn"
    | "Email"
    | "SMS"
    | "Blog";
  title: string;
  content: string;
  scheduledFor: string;
  timezone: string;
  status:
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "SCHEDULED"
    | "PUBLISHING"
    | "DELIVERED_TO_INBOX"
    | "PUBLISHED"
    | "FAILED"
    | "CANCELED";
  approvedAt?: string;
  contentDraftId?: string;
  providerJobId?: string;
  failureReason?: string;
  publishedAt?: string;
  videoProjectId?: string;
  mediaStoragePath?: string;
};

export type PerformanceSnapshot = {
  id: string;
  scheduledPostId: string;
  source: "PROVIDER" | "MANUAL";
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  conversions: number;
  revenue: number;
  spend: number;
  currency: string;
  recordedAt: string;
};

export type ContentKnowledgeItem = {
  id: string;
  scheduledPostId: string;
  performanceSnapshotId?: string;
  entryType: "POST" | "AD";
  channel: string;
  title: string;
  content: string;
  score: number;
  grade: "A" | "B" | "C" | "D";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  strengths: string[];
  scoreVersion: string;
  active: boolean;
  createdAt: string;
};

export function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("bite-me-os-change"));
}

export function workspaceStorageKey(baseKey: string, workspaceId?: string | null): string {
  return workspaceId ? `${baseKey}:${workspaceId}` : baseKey;
}

type StorageLike = {
  length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
};

function matchesWorkspaceCacheKey(key: string): boolean {
  return key === STORAGE_KEYS.workspace
    || key === STORAGE_KEYS.calendarPrefill
    || key === STORAGE_KEYS.drafts
    || key === STORAGE_KEYS.campaigns
    || key === STORAGE_KEYS.media
    || key.startsWith(`${STORAGE_KEYS.drafts}:`)
    || key.startsWith(`${STORAGE_KEYS.campaigns}:`)
    || key.startsWith(`${STORAGE_KEYS.media}:`);
}

export function collectWorkspaceCacheKeys(storage: StorageLike): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (matchesWorkspaceCacheKey(key)) {
      keys.push(key);
    }
  }
  return keys;
}

export function clearWorkspaceClientCache(storage?: StorageLike): void {
  if (typeof window === "undefined" && !storage) return;
  const target = storage || window.localStorage;
  for (const key of collectWorkspaceCacheKeys(target)) {
    target.removeItem(key);
  }
}

export function isDemoMode(): boolean {
  return loadLocal<AccountMode>(STORAGE_KEYS.accountMode, "SUPER_ADMIN") === "DEMO";
}

const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  email: "Email",
  sms: "SMS",
  blog: "Blog",
};

export function generateContent(input: {
  workspace: WorkspaceProfile;
  entryType?: "POST" | "AD";
  channel: string;
  objective: string;
  offer: string;
  callToAction: string;
}): { title: string; copy: string; complianceNote: string } {
  const business = input.workspace.businessName || "Your brand";
  const channel = CHANNEL_LABELS[input.channel] || input.channel;
  const offer = input.offer.trim() || "something worth discovering";
  const cta = input.callToAction.trim() || "Learn more";
  const restricted = ["CANNABIS", "CBD", "ALCOHOL"].includes(input.workspace.industry);
  const title = `${business}: ${input.entryType === "AD" ? "Ad" : "Post"} - ${input.objective} for ${channel}`;
  const copy = restricted
    ? `${business} is built around quality, transparency, and community. ${offer}. ${cta}.`
    : `${business} makes it easier to get ${offer}. Built for ${input.workspace.audience || "people who expect better"}, with a ${input.workspace.voice || "clear, confident"} voice. ${cta}.`;
  const complianceNote = restricted
    ? "Compliance Mode applied: avoids direct purchase pressure, health claims, youth-oriented language, and restricted product promotion. Review local laws and channel policy before publishing."
    : "Standard brand-safety review applied. Verify pricing, claims, links, and offer terms before publishing.";
  return { title, copy, complianceNote };
}

export function demoWorkspace(): WorkspaceProfile {
  return {
    businessName: "Bite Me Jerky",
    website: "https://welikejerky.com",
    industry: "FOOD_BEVERAGE",
    primaryGoal: "Increase direct-to-consumer and Amazon sales",
    audience: "adventure riders and premium snack buyers",
    voice: "bold, witty, and confident",
    completedAt: new Date().toISOString(),
  };
}

export function resetDemoData(): void {
  const now = new Date().toISOString();
  saveLocal(STORAGE_KEYS.demoWorkspace, {
    businessName: "Trailhead Coffee Demo",
    website: "https://example.com",
    industry: "FOOD_BEVERAGE",
    primaryGoal: "Grow local awareness and online orders",
    audience: "busy professionals and outdoor enthusiasts",
    voice: "warm, energetic, and practical",
    completedAt: now,
  } satisfies WorkspaceProfile);
  saveLocal(STORAGE_KEYS.demoDrafts, [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Trailhead Coffee: Build awareness for Instagram",
      channel: "instagram",
      objective: "Build awareness",
      copy: "Your next adventure deserves better coffee. Meet Trailhead Coffee.",
      complianceNote: "Demo content only.",
      status: "DRAFT",
      createdAt: now,
      entryType: "POST",
      originalCopy: "Your next adventure deserves better coffee. Meet Trailhead Coffee.",
      model: "demo",
      promptVersion: "postmotive-content-v2",
    },
  ] satisfies ContentDraft[]);
  saveLocal(STORAGE_KEYS.demoCampaigns, [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Demo Launch Campaign",
      objective: "Build awareness",
      channel: "TikTok",
      status: "ACTIVE",
      startDate: now.slice(0, 10),
      budget: 250,
    },
  ] satisfies CampaignPlan[]);
  saveLocal(STORAGE_KEYS.demoMedia, [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "demo-brand-logo.png",
      type: "image/png",
      size: 48200,
      tags: ["image", "logo", "demo"],
      createdAt: now,
    },
  ] satisfies MediaAsset[]);
  saveLocal(STORAGE_KEYS.demoSchedule, [
    {
      id: "44444444-4444-4444-8444-444444444444",
      entryType: "POST",
      channel: "TikTok",
      title: "Demo behind-the-scenes post",
      content: "A quick look at how Trailhead Coffee prepares each roast.",
      scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      status: "SCHEDULED",
    },
  ] satisfies ScheduledPost[]);
  saveLocal(STORAGE_KEYS.demoFeedback, [] satisfies ContentFeedback[]);
  saveLocal(STORAGE_KEYS.demoPerformance, [] satisfies PerformanceSnapshot[]);
  saveLocal(STORAGE_KEYS.demoKnowledge, [] satisfies ContentKnowledgeItem[]);
  saveLocal(STORAGE_KEYS.demoVideos, []);
}

export function ensureDemoData(): void {
  if (!loadLocal<WorkspaceProfile | null>(STORAGE_KEYS.demoWorkspace, null)) {
    resetDemoData();
  }
}
