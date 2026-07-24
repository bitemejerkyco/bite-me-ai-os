import { getCurrentUserState } from "@/lib/auth/current-user";
import { authorizeWorkspaceMember, type WorkspaceRole } from "@/lib/auth/workspace-auth";
import { getPrismaClient } from "@/lib/prisma";

export type KnowledgeAuthContext = {
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
  role: WorkspaceRole;
};

export async function requireKnowledgeWorkspaceAccess(workspaceSlug: string, requiredRole: WorkspaceRole): Promise<KnowledgeAuthContext> {
  const userState = await getCurrentUserState();
  if (userState.mode === "setup") {
    throw new Error("AUTH_SETUP_REQUIRED");
  }
  if (userState.mode !== "authenticated") {
    throw new Error("AUTH_REQUIRED");
  }

  const membership = await authorizeWorkspaceMember(userState.user.id, workspaceSlug, requiredRole);
  if (!membership.authorized) {
    if (membership.reason === "setup") throw new Error("AUTH_SETUP_REQUIRED");
    if (membership.reason === "not-member") throw new Error("WORKSPACE_ACCESS_DENIED");
    throw new Error("WORKSPACE_ROLE_DENIED");
  }

  const workspace = await getPrismaClient().workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true },
  });

  if (!workspace) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }

  return {
    userId: userState.user.id,
    workspaceId: workspace.id,
    workspaceSlug,
    role: membership.role,
  };
}
