import "server-only";

import { enforceWorkspaceRole } from "@/features/platform/workspace-roles";
import {
  CREATOR_MIN_ROLE_BY_ACTION,
  type CreatorPermissionAction,
} from "@/features/creators/permission-model";

export { CREATOR_MIN_ROLE_BY_ACTION } from "@/features/creators/permission-model";

export async function enforceCreatorPermission(input: {
  workspaceId: string;
  userId: string;
  action: CreatorPermissionAction;
}) {
  await enforceWorkspaceRole({
    workspaceId: input.workspaceId,
    userId: input.userId,
    minimumRole: CREATOR_MIN_ROLE_BY_ACTION[input.action],
  });
}
