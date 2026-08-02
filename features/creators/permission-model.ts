import type { WorkspaceRole } from "@/features/platform/workspace-roles";

export type CreatorPermissionAction =
  | "view"
  | "manage_creators"
  | "manage_campaigns"
  | "review_content"
  | "view_analytics";

export const CREATOR_MIN_ROLE_BY_ACTION: Record<CreatorPermissionAction, WorkspaceRole> = {
  view: "VIEWER",
  manage_creators: "MANAGER",
  manage_campaigns: "MANAGER",
  review_content: "APPROVER",
  view_analytics: "VIEWER",
};
