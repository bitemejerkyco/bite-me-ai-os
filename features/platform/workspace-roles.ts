import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  WORKSPACE_ROLES,
  roleAtLeast,
  type WorkspaceRole,
} from "@/features/platform/workspace-role-rank";

export { WORKSPACE_ROLES, roleAtLeast, type WorkspaceRole };

export async function getWorkspaceRole(input: {
  workspaceId: string;
  userId: string;
}): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_memberships")
    .select("role,status")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`WORKSPACE_ROLE_LOOKUP_FAILED:${error.message}`);
  }

  const row = data as { role?: string | null; status?: string | null } | null;
  if (!row || row.status !== "ACTIVE") return null;
  return row.role || null;
}

export async function enforceWorkspaceRole(input: {
  workspaceId: string;
  userId: string;
  minimumRole: WorkspaceRole;
}): Promise<void> {
  const currentRole = await getWorkspaceRole({
    workspaceId: input.workspaceId,
    userId: input.userId,
  });
  if (!currentRole || !roleAtLeast(currentRole, input.minimumRole)) {
    throw new Error(`WORKSPACE_FORBIDDEN:Requires ${input.minimumRole} role or higher.`);
  }
}
