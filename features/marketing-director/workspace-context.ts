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

export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("AUTH_REQUIRED:Sign in required.");
  }

  const { data: workspaceIdData, error: workspaceIdError } = await supabase.rpc("my_primary_workspace_id");
  if (workspaceIdError) {
    throw new Error(`WORKSPACE_LOOKUP_FAILED:${workspaceIdError.message}`);
  }
  const workspaceId = String(workspaceIdData || "").trim();
  if (!workspaceId) {
    throw new Error("WORKSPACE_REQUIRED:Complete Business Setup first.");
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id,name")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) {
    throw new Error(`WORKSPACE_ACCESS_FAILED:${workspaceError?.message || "Workspace unavailable."}`);
  }

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
    workspaceName: String(workspace.name || "Workspace"),
    email: user.email || null,
  };
}
