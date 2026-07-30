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
  type MediaAsset,
  type ScheduledPost,
  type WorkspaceProfile,
} from "@/features/core/local-os";

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
  const { data, error } = await createClient()
    .from("workspaces")
    .select("id,name,website,industry,primary_goal,audience,voice,updated_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as WorkspaceRow | null;
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
    .select("id,title,channel,objective,copy,compliance_note,status,created_at,entry_type,generation_run_id,original_copy,model,prompt_version")
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
  mime_type: string | null;
  size_bytes: number;
  tags: string[];
  created_at: string;
};

function mediaFromRow(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    name: row.file_name,
    type: row.mime_type || "application/octet-stream",
    size: Number(row.size_bytes),
    tags: row.tags || [],
    createdAt: row.created_at,
    storagePath: row.storage_path,
  };
}

export async function loadCloudMedia(): Promise<MediaAsset[]> {
  if (isDemoMode()) {
    ensureDemoData();
    return loadLocal(STORAGE_KEYS.demoMedia, []);
  }
  const workspace = await getWorkspaceRow();
  if (!workspace) return [];
  const { data, error } = await createClient()
    .from("media_assets")
    .select("id,storage_path,file_name,mime_type,size_bytes,tags,created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => mediaFromRow(row as MediaRow));
}

export async function uploadCloudMedia(
  file: File,
  tags: string[],
): Promise<MediaAsset> {
  if (isDemoMode()) {
    const asset: MediaAsset = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      tags: [...new Set([...tags, "demo"])],
      createdAt: new Date().toISOString(),
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
    })
    .select("id,storage_path,file_name,mime_type,size_bytes,tags,created_at")
    .single();

  if (error) {
    await supabase.storage.from("brand-media").remove([storagePath]);
    throw new Error(error.message);
  }
  return mediaFromRow(data as MediaRow);
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
    .select("id,entry_type,channel,title,content,scheduled_for,timezone,status,approved_at,content_draft_id")
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
  const { error } = await createClient().from("scheduled_posts").upsert({
    id: post.id,
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
  });
  if (error) throw new Error(error.message);
}

export async function cancelCloudScheduledPost(
  post: ScheduledPost,
): Promise<void> {
  await saveCloudScheduledPost({ ...post, status: "CANCELED" });
}
