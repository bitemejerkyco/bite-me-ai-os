import { createClient } from "@/lib/supabase/client";
import {
  demoWorkspace,
  ensureDemoData,
  isDemoMode,
  loadLocal,
  saveLocal,
  STORAGE_KEYS,
  type CampaignPlan,
  type ContentDraft,
  type ContentFeedback,
  type ContentKnowledgeItem,
  type LibraryFolder,
  type MediaAsset,
  type PerformanceSnapshot,
  type ScheduledPost,
  type WorkspaceProfile,
} from "@/features/core/local-os";
import type {
  CreativeVersion,
  VideoProject,
} from "@/features/core/video-project";

type WorkspaceRow = {
  id: string;
  name: string;
  website: string | null;
  industry: WorkspaceProfile["industry"];
  primary_goal: string | null;
  audience: string | null;
  voice: string | null;
  updated_at: string;
};

function workspaceFromRow(row: WorkspaceRow): WorkspaceProfile {
  return {
    id: row.id,
    businessName: row.name,
    website: row.website || "",
    industry: row.industry,
    primaryGoal: row.primary_goal || "",
    audience: row.audience || "",
    voice: row.voice || "",
    completedAt: row.updated_at,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 45) || "workspace";
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await createClient().auth.getUser();
  if (error || !user) throw new Error("Your session expired. Please sign in again.");
  return user.id;
}

export async function getWorkspaceRow(): Promise<WorkspaceRow | null> {
  if (isDemoMode()) return null;
  const client = createClient();
  const primaryWorkspaceId = typeof (client as { rpc?: unknown }).rpc === "function"
    ? String((await client.rpc("my_primary_workspace_id")).data || "").trim()
    : "";
  if (primaryWorkspaceId) {
    const { data, error } = await client
      .from("workspaces")
      .select("id,name,website,industry,primary_goal,audience,voice,updated_at")
      .eq("id", primaryWorkspaceId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data as WorkspaceRow;
  }

  return null;
}

export async function loadCloudWorkspace(): Promise<WorkspaceProfile | null> {
  if (isDemoMode()) {
    ensureDemoData();
    return loadLocal(STORAGE_KEYS.demoWorkspace, demoWorkspace());
  }
  const row = await getWorkspaceRow();
  return row ? workspaceFromRow(row) : null;
}

export async function saveCloudWorkspace(
  profile: WorkspaceProfile,
): Promise<WorkspaceProfile> {
  if (isDemoMode()) {
    saveLocal(STORAGE_KEYS.demoWorkspace, profile);
    return profile;
  }
  const supabase = createClient();
  const userId = await currentUserId();
  const { data, error } = await supabase.rpc("save_my_workspace", {
    workspace_name: profile.businessName,
    workspace_slug: `${slugify(profile.businessName)}-${userId.slice(0, 8)}`,
    workspace_website: profile.website,
    workspace_industry: profile.industry,
    workspace_primary_goal: profile.primaryGoal,
    workspace_audience: profile.audience,
    workspace_voice: profile.voice,
  });
  if (error) throw new Error(error.message);
  return workspaceFromRow(data as WorkspaceRow);
}

async function requireWorkspace(): Promise<WorkspaceRow> {
  const workspace = await getWorkspaceRow();
  if (!workspace) {
    throw new Error("Save Business Setup before using this feature.");
  }
  return workspace;
}

export async function loadCloudDrafts(): Promise<ContentDraft[]> {
  if (isDemoMode()) {
    ensureDemoData();
    return loadLocal(STORAGE_KEYS.demoDrafts, []);
  }
  const workspace = await getWorkspaceRow();
  if (!workspace) return [];
  const { data, error } = await createClient()
    .from("content_drafts")
    .select("id,title,channel,objective,copy,compliance_note,status,created_at,entry_type,generation_run_id,original_copy,model,prompt_version,content_format,video_project_id,media_storage_path,folder_id")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    channel: row.channel,
    objective: row.objective,
    copy: row.copy,
    complianceNote: row.compliance_note || "",
    status: row.status === "APPROVED" ? "APPROVED" : "DRAFT",
    createdAt: row.created_at,
    entryType: row.entry_type === "AD" ? "AD" : "POST",
    generationRunId: row.generation_run_id || undefined,
    originalCopy: row.original_copy || undefined,
    model: row.model || undefined,
    promptVersion: row.prompt_version || undefined,
    contentFormat:
      row.content_format === "VERTICAL_VIDEO" ? "VERTICAL_VIDEO" : "STATIC",
    videoProjectId: row.video_project_id || undefined,
    mediaStoragePath: row.media_storage_path || undefined,
    folderId: row.folder_id || undefined,
  }));
}

export async function saveCloudDraft(draft: ContentDraft): Promise<void> {
  if (isDemoMode()) {
    const drafts = loadLocal<ContentDraft[]>(STORAGE_KEYS.demoDrafts, []);
    const next = drafts.some((item) => item.id === draft.id)
      ? drafts.map((item) => (item.id === draft.id ? draft : item))
      : [draft, ...drafts];
    saveLocal(STORAGE_KEYS.demoDrafts, next);
    return;
  }
  const workspace = await requireWorkspace();
  const userId = await currentUserId();
  const { error } = await createClient().from("content_drafts").upsert({
    id: draft.id,
    workspace_id: workspace.id,
    created_by: userId,
    channel: draft.channel,
    objective: draft.objective,
    title: draft.title,
    copy: draft.copy,
    compliance_note: draft.complianceNote,
    status: draft.status,
    entry_type: draft.entryType || "POST",
    generation_run_id: draft.generationRunId || null,
    original_copy: draft.originalCopy || draft.copy,
    model: draft.model || null,
    prompt_version: draft.promptVersion || null,
    content_format: draft.contentFormat || "STATIC",
    video_project_id: draft.videoProjectId || null,
    media_storage_path: draft.mediaStoragePath || null,
    folder_id: draft.folderId || null,
  });
  if (error) throw new Error(error.message);
}

export async function saveCloudContentFeedback(
  feedback: ContentFeedback,
): Promise<void> {
  if (isDemoMode()) {
    const current = loadLocal<ContentFeedback[]>(STORAGE_KEYS.demoFeedback, []);
    saveLocal(STORAGE_KEYS.demoFeedback, [feedback, ...current]);
    return;
  }
  const workspace = await requireWorkspace();
  const userId = await currentUserId();
  const { error } = await createClient().from("content_feedback").insert({
    id: feedback.id,
    workspace_id: workspace.id,
    draft_id: feedback.draftId || null,
    generation_run_id: feedback.generationRunId || null,
    scheduled_post_id: feedback.scheduledPostId || null,
    created_by: userId,
    signal: feedback.signal,
    reason: feedback.reason.slice(0, 200),
    notes: feedback.notes.slice(0, 1_000),
    original_copy: feedback.originalCopy || null,
    final_copy: feedback.finalCopy || null,
    entry_type: feedback.entryType,
    channel: feedback.channel,
  });
  if (error) throw new Error(error.message);
}

export async function loadCloudCampaigns(): Promise<CampaignPlan[]> {
  if (isDemoMode()) {
    ensureDemoData();
    return loadLocal(STORAGE_KEYS.demoCampaigns, []);
  }
  const workspace = await getWorkspaceRow();
  if (!workspace) return [];
  const { data, error } = await createClient()
    .from("campaigns")
    .select("id,name,objective,channel,status,start_date,budget")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    objective: row.objective,
    channel: row.channel,
    status: row.status as CampaignPlan["status"],
    startDate: row.start_date,
    budget: Number(row.budget),
  }));
}

export async function saveCloudCampaign(campaign: CampaignPlan): Promise<void> {
  if (isDemoMode()) {
    const campaigns = loadLocal<CampaignPlan[]>(STORAGE_KEYS.demoCampaigns, []);
    const next = campaigns.some((item) => item.id === campaign.id)
      ? campaigns.map((item) => (item.id === campaign.id ? campaign : item))
      : [campaign, ...campaigns];
    saveLocal(STORAGE_KEYS.demoCampaigns, next);
    return;
  }
  const workspace = await requireWorkspace();
  const userId = await currentUserId();
  const { error } = await createClient().from("campaigns").upsert({
    id: campaign.id,
    workspace_id: workspace.id,
    created_by: userId,
    name: campaign.name,
    objective: campaign.objective,
    channel: campaign.channel,
    status: campaign.status,
    start_date: campaign.startDate,
    budget: campaign.budget,
  });
  if (error) throw new Error(error.message);
}

type MediaRow = {
  id: string;
  storage_path: string;
  file_name: string;
  asset_type: string;
  mime_type: string | null;
  size_bytes: number;
  tags: string[];
  created_at: string;
  folder_id: string | null;
  source: MediaAsset["source"] | null;
  generation_status: MediaAsset["generationStatus"] | null;
  generation_job_id: string | null;
  thumbnail_path: string | null;
  poster_path: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  archived_at: string | null;
  is_favorite?: boolean | null;
};

function mediaFromRow(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    name: row.file_name,
    type: row.mime_type || row.asset_type || "application/octet-stream",
    size: Number(row.size_bytes),
    tags: row.tags || [],
    createdAt: row.created_at,
    storagePath: row.storage_path,
    folderId: row.folder_id || undefined,
    source: row.source || undefined,
    generationStatus: row.generation_status || undefined,
    generationJobId: row.generation_job_id || undefined,
    thumbnailPath: row.thumbnail_path || undefined,
    posterPath: row.poster_path || undefined,
    width: Number.isFinite(row.width) ? Number(row.width) : undefined,
    height: Number.isFinite(row.height) ? Number(row.height) : undefined,
    durationSeconds: Number.isFinite(row.duration_seconds)
      ? Number(row.duration_seconds)
      : undefined,
    archivedAt: row.archived_at || undefined,
    isFavorite: row.is_favorite ?? false,
  };
}

export async function loadCloudMedia(options?: {
  includeArchived?: boolean;
}): Promise<MediaAsset[]> {
  if (isDemoMode()) {
    ensureDemoData();
    return loadLocal(STORAGE_KEYS.demoMedia, []);
  }
  const workspace = await getWorkspaceRow();
  if (!workspace) return [];
  let query = createClient()
    .from("media_assets")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mediaFromRow(row as MediaRow));
}

export async function uploadCloudMedia(
  file: File,
  tags: string[],
  folderId?: string,
  options?: {
    source?: MediaAsset["source"];
    generationStatus?: MediaAsset["generationStatus"];
    generationJobId?: string;
    thumbnailPath?: string;
    posterPath?: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
  },
): Promise<MediaAsset> {
  if (isDemoMode()) {
    const asset: MediaAsset = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      tags: [...new Set([...tags, "demo"])],
      createdAt: new Date().toISOString(),
      folderId,
      source: options?.source || "UPLOADED",
      generationStatus: options?.generationStatus || "READY",
      generationJobId: options?.generationJobId,
      thumbnailPath: options?.thumbnailPath,
      posterPath: options?.posterPath,
      width: options?.width,
      height: options?.height,
      durationSeconds: options?.durationSeconds,
      isFavorite: false,
    };
    const media = loadLocal<MediaAsset[]>(STORAGE_KEYS.demoMedia, []);
    saveLocal(STORAGE_KEYS.demoMedia, [asset, ...media]);
    return asset;
  }
  const supabase = createClient();
  const workspace = await requireWorkspace();
  const userId = await currentUserId();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-160);
  const storagePath = `${workspace.id}/${userId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("brand-media")
    .upload(storagePath, file, { upsert: false, contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      workspace_id: workspace.id,
      uploaded_by: userId,
      storage_path: storagePath,
      file_name: file.name,
      asset_type: file.type.split("/")[0] || "asset",
      mime_type: file.type || null,
      size_bytes: file.size,
      tags,
      folder_id: folderId || null,
      source: options?.source || "UPLOADED",
      generation_status: options?.generationStatus || "READY",
      generation_job_id: options?.generationJobId || null,
      thumbnail_path: options?.thumbnailPath || null,
      poster_path: options?.posterPath || null,
      width: Number.isFinite(options?.width) ? options?.width : null,
      height: Number.isFinite(options?.height) ? options?.height : null,
      duration_seconds: Number.isFinite(options?.durationSeconds)
        ? options?.durationSeconds
        : null,
      is_favorite: false,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from("brand-media").remove([storagePath]);
    throw new Error(error.message);
  }
  return mediaFromRow(data as MediaRow);
}

export async function loadCloudFolders(
  libraryType: LibraryFolder["libraryType"],
): Promise<LibraryFolder[]> {
  if (isDemoMode()) {
    return loadLocal<LibraryFolder[]>(STORAGE_KEYS.demoFolders, []).filter(
      (folder) => folder.libraryType === libraryType,
    );
  }
  const workspace = await getWorkspaceRow();
  if (!workspace) return [];
  const { data, error } = await createClient()
    .from("library_folders")
    .select("id,library_type,name,parent_id,created_at")
    .eq("workspace_id", workspace.id)
    .eq("library_type", libraryType)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    libraryType: row.library_type as LibraryFolder["libraryType"],
    name: row.name,
    parentId: row.parent_id || undefined,
    createdAt: row.created_at,
  }));
}

export async function createCloudFolder(
  libraryType: LibraryFolder["libraryType"],
  name: string,
): Promise<LibraryFolder> {
  const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!cleanName) throw new Error("Enter a folder name.");
  if (isDemoMode()) {
    const folder: LibraryFolder = {
      id: crypto.randomUUID(),
      libraryType,
      name: cleanName,
      createdAt: new Date().toISOString(),
    };
    const current = loadLocal<LibraryFolder[]>(STORAGE_KEYS.demoFolders, []);
    saveLocal(STORAGE_KEYS.demoFolders, [folder, ...current]);
    return folder;
  }
  const workspace = await requireWorkspace();
  const userId = await currentUserId();
  const { data, error } = await createClient()
    .from("library_folders")
    .insert({
      workspace_id: workspace.id,
      created_by: userId,
      library_type: libraryType,
      name: cleanName,
    })
    .select("id,library_type,name,parent_id,created_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    libraryType: data.library_type as LibraryFolder["libraryType"],
    name: data.name,
    parentId: data.parent_id || undefined,
    createdAt: data.created_at,
  };
}

export async function renameCloudFolder(
  folder: LibraryFolder,
  name: string,
): Promise<LibraryFolder> {
  const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!cleanName) throw new Error("Enter a folder name.");
  if (isDemoMode()) {
    const updated = { ...folder, name: cleanName };
    const current = loadLocal<LibraryFolder[]>(STORAGE_KEYS.demoFolders, []);
    saveLocal(
      STORAGE_KEYS.demoFolders,
      current.map((item) => (item.id === folder.id ? updated : item)),
    );
    return updated;
  }
  const { error } = await createClient()
    .from("library_folders")
    .update({ name: cleanName })
    .eq("id", folder.id);
  if (error) throw new Error(error.message);
  return { ...folder, name: cleanName };
}

export async function moveCloudDraftToFolder(
  draftId: string,
  folderId?: string,
): Promise<void> {
  if (isDemoMode()) {
    const drafts = loadLocal<ContentDraft[]>(STORAGE_KEYS.demoDrafts, []);
    saveLocal(
      STORAGE_KEYS.demoDrafts,
      drafts.map((draft) =>
        draft.id === draftId ? { ...draft, folderId } : draft,
      ),
    );
    return;
  }
  const { error } = await createClient()
    .from("content_drafts")
    .update({ folder_id: folderId || null })
    .eq("id", draftId);
  if (error) throw new Error(error.message);
}

export async function moveCloudMediaToFolder(
  assetId: string,
  folderId?: string,
): Promise<void> {
  if (isDemoMode()) {
    const assets = loadLocal<MediaAsset[]>(STORAGE_KEYS.demoMedia, []);
    saveLocal(
      STORAGE_KEYS.demoMedia,
      assets.map((asset) =>
        asset.id === assetId ? { ...asset, folderId } : asset,
      ),
    );
    return;
  }
  const { error } = await createClient()
    .from("media_assets")
    .update({ folder_id: folderId || null })
    .eq("id", assetId);
  if (error) throw new Error(error.message);
}

export async function removeCloudMedia(asset: MediaAsset): Promise<void> {
  if (isDemoMode()) {
    const media = loadLocal<MediaAsset[]>(STORAGE_KEYS.demoMedia, []);
    saveLocal(
      STORAGE_KEYS.demoMedia,
      media.filter((item) => item.id !== asset.id),
    );
    return;
  }
  const supabase = createClient();
  if (asset.storagePath) {
    const { error } = await supabase.storage
      .from("brand-media")
      .remove([asset.storagePath]);
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.from("media_assets").delete().eq("id", asset.id);
  if (error) throw new Error(error.message);
}

export async function updateCloudMediaAsset(
  assetId: string,
  updates: {
    name?: string;
    tags?: string[];
    folderId?: string;
    archivedAt?: string | null;
    isFavorite?: boolean;
  },
): Promise<void> {
  if (isDemoMode()) {
    const media = loadLocal<MediaAsset[]>(STORAGE_KEYS.demoMedia, []);
    const next = media.map((item) => {
      if (item.id !== assetId) return item;
      return {
        ...item,
        name: updates.name ?? item.name,
        tags: updates.tags ?? item.tags,
        folderId: updates.folderId ?? item.folderId,
        archivedAt:
          updates.archivedAt === undefined ? item.archivedAt : updates.archivedAt || undefined,
        isFavorite:
          updates.isFavorite === undefined ? item.isFavorite : updates.isFavorite,
      };
    });
    saveLocal(STORAGE_KEYS.demoMedia, next);
    return;
  }

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.file_name = updates.name;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.folderId !== undefined) payload.folder_id = updates.folderId || null;
  if (updates.archivedAt !== undefined) payload.archived_at = updates.archivedAt;
  if (updates.isFavorite !== undefined) payload.is_favorite = updates.isFavorite;
  if (!Object.keys(payload).length) return;

  const { error } = await createClient().from("media_assets").update(payload).eq("id", assetId);
  if (error) throw new Error(error.message);
}

export async function resolveCloudMediaUrl(
  storagePath: string,
): Promise<string> {
  if (!storagePath) return "";
  if (isDemoMode()) return "";
  const { data, error } = await createClient()
    .storage
    .from("brand-media")
    .createSignedUrl(storagePath, 3_600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

type ScheduledPostRow = {
  id: string;
  entry_type: ScheduledPost["entryType"];
  channel: ScheduledPost["channel"];
  title: string;
  content: string;
  scheduled_for: string;
  timezone: string;
  status: ScheduledPost["status"];
  approved_at: string | null;
  content_draft_id: string | null;
  provider_job_id: string | null;
  failure_reason: string | null;
  published_at: string | null;
  video_project_id: string | null;
  media_storage_path: string | null;
};

function scheduledPostFromRow(row: ScheduledPostRow): ScheduledPost {
  return {
    id: row.id,
    entryType: row.entry_type,
    channel: row.channel,
    title: row.title,
    content: row.content,
    scheduledFor: row.scheduled_for,
    timezone: row.timezone,
    status: row.status,
    approvedAt: row.approved_at || undefined,
    contentDraftId: row.content_draft_id || undefined,
    providerJobId: row.provider_job_id || undefined,
    failureReason: row.failure_reason || undefined,
    publishedAt: row.published_at || undefined,
    videoProjectId: row.video_project_id || undefined,
    mediaStoragePath: row.media_storage_path || undefined,
  };
}

export async function loadCloudSchedule(): Promise<ScheduledPost[]> {
  if (isDemoMode()) {
    ensureDemoData();
    return loadLocal(STORAGE_KEYS.demoSchedule, []);
  }
  const workspace = await getWorkspaceRow();
  if (!workspace) return [];
  const { data, error } = await createClient()
    .from("scheduled_posts")
    .select("id,entry_type,channel,title,content,scheduled_for,timezone,status,approved_at,content_draft_id,provider_job_id,failure_reason,published_at,video_project_id,media_storage_path")
    .eq("workspace_id", workspace.id)
    .order("scheduled_for", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((row) =>
    scheduledPostFromRow(row as ScheduledPostRow),
  );
}

export async function saveCloudScheduledPost(
  post: ScheduledPost,
): Promise<void> {
  if (isDemoMode()) {
    const posts = loadLocal<ScheduledPost[]>(STORAGE_KEYS.demoSchedule, []);
    const next = posts.some((item) => item.id === post.id)
      ? posts.map((item) => (item.id === post.id ? post : item))
      : [...posts, post];
    saveLocal(STORAGE_KEYS.demoSchedule, next);
    return;
  }
  const workspace = await requireWorkspace();
  const userId = await currentUserId();
  let existingQuery = createClient()
    .from("scheduled_posts")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("entry_type", post.entryType)
    .eq("channel", post.channel)
    .eq("scheduled_for", post.scheduledFor);
  existingQuery = post.contentDraftId
    ? existingQuery.eq("content_draft_id", post.contentDraftId)
    : existingQuery.eq("title", post.title).eq("content", post.content);
  const { data: existingPost, error: existingError } = await existingQuery
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  const { error } = await createClient().from("scheduled_posts").upsert({
    id: (existingPost as { id?: string } | null)?.id || post.id,
    workspace_id: workspace.id,
    created_by: userId,
    entry_type: post.entryType,
    channel: post.channel,
    title: post.title,
    content: post.content,
    scheduled_for: post.scheduledFor,
    timezone: post.timezone,
    status: post.status,
    approved_by: post.approvedAt ? userId : null,
    approved_at: post.approvedAt || null,
    content_draft_id: post.contentDraftId || null,
    video_project_id: post.videoProjectId || null,
    media_storage_path: post.mediaStoragePath || null,
  });
  if (error) throw new Error(error.message);
}

type VideoProjectRow = {
  id: string;
  content_draft_id: string | null;
  workflow_key: string | null;
  credit_request_id: string | null;
  title: string;
  channel: VideoProject["channel"];
  objective: string;
  prompt: string;
  script: string;
  caption: string;
  hashtags: string[] | null;
  call_to_action: string | null;
  scenes: VideoProject["scenes"];
  duration_seconds: VideoProject["durationSeconds"];
  aspect_ratio: "9:16";
  voice: VideoProject["voice"];
  voice_disclosure: boolean;
  music_mode: VideoProject["musicMode"];
  licensed_music_asset_id: string | null;
  provider: VideoProject["provider"];
  routing_tier: VideoProject["routingTier"] | null;
  provider_model: string | null;
  provider_job_id: string | null;
  provider_progress: number | null;
  video_storage_path: string | null;
  voiceover_storage_path: string | null;
  status: VideoProject["status"];
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

function videoProjectFromRow(row: VideoProjectRow): VideoProject {
  return {
    id: row.id,
    contentDraftId: row.content_draft_id || undefined,
    workflowKey: row.workflow_key || undefined,
    title: row.title,
    channel: row.channel,
    objective: row.objective,
    prompt: row.prompt,
    script: row.script,
    caption: row.caption,
    hashtags: row.hashtags || [],
    callToAction: row.call_to_action || "",
    scenes: row.scenes || [],
    durationSeconds: Number(row.duration_seconds) as VideoProject["durationSeconds"],
    aspectRatio: "9:16",
    voice: row.voice,
    voiceDisclosure: row.voice_disclosure,
    musicMode: row.music_mode,
    licensedMusicAssetId: row.licensed_music_asset_id || undefined,
    provider: row.provider,
    routingTier: row.routing_tier || undefined,
    providerModel: row.provider_model || undefined,
    providerJobId: row.provider_job_id || undefined,
    providerProgress: row.provider_progress ?? undefined,
    videoStoragePath: row.video_storage_path || undefined,
    voiceoverStoragePath: row.voiceover_storage_path || undefined,
    status: row.status,
    failureReason: row.failure_reason || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadCloudVideoProjects(): Promise<VideoProject[]> {
  if (isDemoMode()) {
    return loadLocal<VideoProject[]>(STORAGE_KEYS.demoVideos, []);
  }
  const workspace = await getWorkspaceRow();
  if (!workspace) return [];
  const { data, error } = await createClient()
    .from("video_projects")
    .select("id,content_draft_id,workflow_key,credit_request_id,title,channel,objective,prompt,script,caption,hashtags,call_to_action,scenes,duration_seconds,aspect_ratio,voice,voice_disclosure,music_mode,licensed_music_asset_id,provider,routing_tier,provider_model,provider_job_id,provider_progress,video_storage_path,voiceover_storage_path,status,failure_reason,created_at,updated_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) =>
    videoProjectFromRow(row as VideoProjectRow),
  );
}

export async function saveCloudVideoProject(
  project: VideoProject,
): Promise<void> {
  if (isDemoMode()) {
    const current = loadLocal<VideoProject[]>(STORAGE_KEYS.demoVideos, []);
    const next = current.some((item) => item.id === project.id)
      ? current.map((item) => (item.id === project.id ? project : item))
      : [project, ...current];
    saveLocal(STORAGE_KEYS.demoVideos, next);
    return;
  }
  const workspace = await requireWorkspace();
  const userId = await currentUserId();
  const { error } = await createClient().from("video_projects").upsert({
    id: project.id,
    workspace_id: workspace.id,
    content_draft_id: project.contentDraftId || null,
    workflow_key: project.workflowKey || null,
    credit_request_id: null,
    created_by: userId,
    title: project.title,
    channel: project.channel,
    objective: project.objective,
    prompt: project.prompt,
    script: project.script,
    caption: project.caption,
    hashtags: project.hashtags || [],
    call_to_action: project.callToAction || "",
    scenes: project.scenes,
    duration_seconds: project.durationSeconds,
    aspect_ratio: project.aspectRatio,
    voice: project.voice,
    voice_disclosure: project.voiceDisclosure,
    music_mode: project.musicMode,
    licensed_music_asset_id: project.licensedMusicAssetId || null,
    provider: project.provider,
    routing_tier: project.routingTier || null,
    provider_model: project.providerModel || null,
    provider_job_id: project.providerJobId || null,
    provider_progress: project.providerProgress ?? null,
    video_storage_path: project.videoStoragePath || null,
    voiceover_storage_path: project.voiceoverStoragePath || null,
    status: project.status,
    failure_reason: project.failureReason || null,
  });
  if (error) throw new Error(error.message);
}

export async function loadCloudCreativeVersions(
  videoProjectId: string,
): Promise<CreativeVersion[]> {
  if (isDemoMode()) return [];
  const workspace = await getWorkspaceRow();
  if (!workspace) return [];
  const { data, error } = await createClient()
    .from("video_project_versions")
    .select("id,video_project_id,asset_kind,version_number,provider_job_id,storage_path,prompt,voice,voice_instructions,created_at")
    .eq("workspace_id", workspace.id)
    .eq("video_project_id", videoProjectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    videoProjectId: row.video_project_id,
    assetKind: row.asset_kind === "VOICEOVER" ? "VOICEOVER" : "VIDEO",
    versionNumber: Number(row.version_number),
    providerJobId: row.provider_job_id || undefined,
    storagePath: row.storage_path,
    prompt: row.prompt,
    voice: row.voice || undefined,
    voiceInstructions: row.voice_instructions || undefined,
    createdAt: row.created_at,
  }));
}

export async function saveCloudCreativeVersion(
  version: CreativeVersion,
): Promise<void> {
  if (isDemoMode()) return;
  const workspace = await requireWorkspace();
  const userId = await currentUserId();
  const { error } = await createClient()
    .from("video_project_versions")
    .insert({
      id: version.id,
      workspace_id: workspace.id,
      video_project_id: version.videoProjectId,
      created_by: userId,
      asset_kind: version.assetKind,
      version_number: version.versionNumber,
      provider_job_id: version.providerJobId || null,
      storage_path: version.storagePath,
      prompt: version.prompt,
      voice: version.voice || null,
      voice_instructions: version.voiceInstructions || null,
    });
  if (error) throw new Error(error.message);
}

export async function cancelCloudScheduledPost(
  post: ScheduledPost,
): Promise<void> {
  await saveCloudScheduledPost({ ...post, status: "CANCELED" });
}

export async function loadCloudPerformance(): Promise<PerformanceSnapshot[]> {
  if (isDemoMode()) {
    ensureDemoData();
    return loadLocal(STORAGE_KEYS.demoPerformance, []);
  }
  const workspace = await getWorkspaceRow();
  if (!workspace) return [];
  const { data, error } = await createClient()
    .from("content_performance_snapshots")
    .select("id,scheduled_post_id,source,impressions,reach,engagements,clicks,conversions,revenue,spend,currency,recorded_at")
    .eq("workspace_id", workspace.id)
    .order("recorded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    scheduledPostId: row.scheduled_post_id,
    source: row.source === "MANUAL" ? "MANUAL" : "PROVIDER",
    impressions: Number(row.impressions),
    reach: Number(row.reach),
    engagements: Number(row.engagements),
    clicks: Number(row.clicks),
    conversions: Number(row.conversions),
    revenue: Number(row.revenue),
    spend: Number(row.spend),
    currency: row.currency,
    recordedAt: row.recorded_at,
  }));
}

export async function loadCloudKnowledge(): Promise<ContentKnowledgeItem[]> {
  if (isDemoMode()) {
    ensureDemoData();
    return loadLocal(STORAGE_KEYS.demoKnowledge, []);
  }
  const workspace = await getWorkspaceRow();
  if (!workspace) return [];
  const { data, error } = await createClient()
    .from("content_knowledge")
    .select("id,scheduled_post_id,performance_snapshot_id,entry_type,channel,title,content,score,grade,confidence,strengths,score_version,active,created_at")
    .eq("workspace_id", workspace.id)
    .eq("active", true)
    .order("score", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    scheduledPostId: row.scheduled_post_id,
    performanceSnapshotId: row.performance_snapshot_id || undefined,
    entryType: row.entry_type === "AD" ? "AD" : "POST",
    channel: row.channel,
    title: row.title,
    content: row.content,
    score: Number(row.score),
    grade: row.grade as ContentKnowledgeItem["grade"],
    confidence: row.confidence as ContentKnowledgeItem["confidence"],
    strengths: row.strengths || [],
    scoreVersion: row.score_version,
    active: Boolean(row.active),
    createdAt: row.created_at,
  }));
}

export async function saveCloudKnowledge(
  item: ContentKnowledgeItem,
): Promise<void> {
  if (isDemoMode()) {
    const current = loadLocal<ContentKnowledgeItem[]>(
      STORAGE_KEYS.demoKnowledge,
      [],
    );
    const next = current.some(
      (knowledge) => knowledge.scheduledPostId === item.scheduledPostId,
    )
      ? current.map((knowledge) =>
          knowledge.scheduledPostId === item.scheduledPostId ? item : knowledge,
        )
      : [item, ...current];
    saveLocal(STORAGE_KEYS.demoKnowledge, next);
    return;
  }
  const workspace = await requireWorkspace();
  const userId = await currentUserId();
  const { error } = await createClient().from("content_knowledge").upsert(
    {
      id: item.id,
      workspace_id: workspace.id,
      scheduled_post_id: item.scheduledPostId,
      performance_snapshot_id: item.performanceSnapshotId || null,
      created_by: userId,
      entry_type: item.entryType,
      channel: item.channel,
      title: item.title,
      content: item.content,
      score: item.score,
      grade: item.grade,
      confidence: item.confidence,
      strengths: item.strengths,
      score_version: item.scoreVersion,
      active: item.active,
    },
    { onConflict: "scheduled_post_id" },
  );
  if (error) throw new Error(error.message);
}
