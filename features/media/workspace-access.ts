export type WorkspaceScopedRow = {
  workspace_id: string | null;
};

export function rowBelongsToWorkspace(workspaceId: string, rowWorkspaceId: string | null): boolean {
  return Boolean(workspaceId) && Boolean(rowWorkspaceId) && workspaceId === rowWorkspaceId;
}

export function filterRowsForWorkspace<T extends WorkspaceScopedRow>(
  workspaceId: string,
  rows: T[],
): T[] {
  return rows.filter((row) => rowBelongsToWorkspace(workspaceId, row.workspace_id));
}
