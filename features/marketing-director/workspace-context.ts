import "server-only";

import { createClient } from "@/lib/supabase/server";

export type WorkspaceContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  firstName: string;
  workspaceId: string;
  workspaceName: string;
  email: string | null;
};

type WorkspaceRow = {
  id: string;
  name: string | null;
};

function safeText(value: unknown): string {
  return String(value || "").trim();
}

function slugFromUserId(userId: string): string {
  const compact = userId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `workspace-${compact.slice(0, 24) || "default"}`;
}

function defaultWorkspaceName(user: { user_metadata?: Record<string, unknown> | null }): string {
  const metadata = user.user_metadata || {};
  const candidates = [
    metadata.organization,
    metadata.organization_name,
    metadata.company,
    metadata.company_name,
    metadata.org_name,
    metadata.business_name,
  ];
  for (const candidate of candidates) {
    const value = safeText(candidate);
    if (value) return value.slice(0, 120);
  }
  return "My Workspace";
}

function firstNameFromUser(fullName: unknown, fallbackEmail: string | null): string {
  const asText = String(fullName || "").trim();
  if (asText) {
    return asText.split(/\s+/u)[0] || "there";
  }
  if (fallbackEmail) {
    return fallbackEmail.split("@")[0] || "there";
  }
  return "there";
}

async function findAccessibleWorkspaceId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const { data, error } = await supabase.rpc("my_primary_workspace_id");
  if (error) {
    throw new Error(`WORKSPACE_LOOKUP_FAILED:${error.message}`);
  }
  return safeText(data);
}

async function readWorkspaceById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<WorkspaceRow | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`WORKSPACE_ACCESS_FAILED:${error.message}`);
  }

  return (data as WorkspaceRow | null) || null;
}

async function ensureOwnerMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { workspaceId: string; userId: string },
): Promise<void> {
  const payload = {
    workspace_id: input.workspaceId,
    user_id: input.userId,
    role: "OWNER",
    billing_exempt: false,
    status: "ACTIVE",
  };

  const { error } = await supabase
    .from("workspace_memberships")
    .upsert(payload, { onConflict: "workspace_id,user_id" });

  if (!error) return;

  if (!String(error.message || "").toLowerCase().includes("status")) {
    throw new Error(`WORKSPACE_MEMBERSHIP_BOOTSTRAP_FAILED:${error.message}`);
  }

  const { error: legacyError } = await supabase
    .from("workspace_memberships")
    .upsert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        role: "OWNER",
        billing_exempt: false,
      },
      { onConflict: "workspace_id,user_id" },
    );

  if (legacyError) {
    throw new Error(`WORKSPACE_MEMBERSHIP_BOOTSTRAP_FAILED:${legacyError.message}`);
  }
}

async function findOwnedWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<WorkspaceRow | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`WORKSPACE_OWNER_LOOKUP_FAILED:${error.message}`);
  }

  return (data as WorkspaceRow | null) || null;
}

async function ensureWorkspaceForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; user_metadata?: Record<string, unknown> | null },
): Promise<WorkspaceRow> {
  const existing = await findOwnedWorkspace(supabase, user.id);
  if (existing) {
    await ensureOwnerMembership(supabase, { workspaceId: existing.id, userId: user.id });
    return existing;
  }

  const workspaceName = defaultWorkspaceName(user);
  const slug = slugFromUserId(user.id);

  const { data: created, error: createError } = await supabase
    .from("workspaces")
    .insert({
      owner_user_id: user.id,
      name: workspaceName,
      slug,
    })
    .select("id,name")
    .maybeSingle();

  if (createError) {
    const fallback = await findOwnedWorkspace(supabase, user.id);
    if (!fallback) {
      throw new Error(`WORKSPACE_BOOTSTRAP_FAILED:${createError.message}`);
    }
    await ensureOwnerMembership(supabase, { workspaceId: fallback.id, userId: user.id });
    return fallback;
  }

  const workspace = (created as WorkspaceRow | null) || null;
  if (!workspace) {
    const fallback = await findOwnedWorkspace(supabase, user.id);
    if (!fallback) {
      throw new Error("WORKSPACE_BOOTSTRAP_FAILED:Workspace creation returned no record.");
    }
    await ensureOwnerMembership(supabase, { workspaceId: fallback.id, userId: user.id });
    return fallback;
  }

  await ensureOwnerMembership(supabase, { workspaceId: workspace.id, userId: user.id });
  return workspace;
}

export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("AUTH_REQUIRED:Sign in required.");
  }

  let workspaceId = await findAccessibleWorkspaceId(supabase);
  let workspace: WorkspaceRow | null = null;

  if (workspaceId) {
    workspace = await readWorkspaceById(supabase, workspaceId);
  }

  if (!workspace) {
    const bootstrapped = await ensureWorkspaceForUser(supabase, user);
    workspaceId = bootstrapped.id;
    workspace = await readWorkspaceById(supabase, workspaceId);
  }

  if (!workspace) {
    throw new Error("WORKSPACE_ACCESS_FAILED:Workspace unavailable.");
  }

  await ensureOwnerMembership(supabase, { workspaceId, userId: user.id });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    firstName: firstNameFromUser(profile?.full_name ?? user.user_metadata?.full_name, user.email || null),
    workspaceId,
    workspaceName: String(workspace.name || "My Workspace"),
    email: user.email || null,
  };
}
