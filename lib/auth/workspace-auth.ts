import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { getPrismaClient } from "@/lib/prisma";

export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

export type WorkspaceAuthResult =
  | { authorized: true; role: WorkspaceRole; reason?: undefined }
  | { authorized: false; role?: undefined; reason: "setup" | "not-member" | "insufficient-role" };

export function hasRequiredRole(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export async function authorizeWorkspaceMember(
  userId: string,
  workspaceSlug: string,
  requiredRole: WorkspaceRole = "VIEWER"
): Promise<WorkspaceAuthResult> {
  if (!isSupabaseConfigured || !isDatabaseConfigured) {
    return { authorized: false, reason: "setup" };
  }

  const prisma = getPrismaClient();

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspace: {
        slug: workspaceSlug,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    return { authorized: false, reason: "not-member" };
  }

  const role = membership.role as WorkspaceRole;
  if (!hasRequiredRole(role, requiredRole)) {
    return { authorized: false, reason: "insufficient-role" };
  }

  return { authorized: true, role };
}
