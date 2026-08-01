export const WORKSPACE_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "EDITOR",
  "APPROVER",
  "VIEWER",
  "GUEST",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

const RANK: Record<string, number> = {
  SUPER_ADMIN: 100,
  OWNER: 90,
  ADMIN: 80,
  MANAGER: 70,
  MEMBER: 60,
  EDITOR: 60,
  APPROVER: 50,
  VIEWER: 40,
  DEMO: 20,
  GUEST: 10,
};

function normalizeRole(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

export function roleAtLeast(currentRole: unknown, minimumRole: WorkspaceRole): boolean {
  const current = normalizeRole(currentRole);
  const minimum = normalizeRole(minimumRole);
  return (RANK[current] || 0) >= (RANK[minimum] || 0);
}
