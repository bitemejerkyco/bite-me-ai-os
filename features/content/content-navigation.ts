import type { ContentDraft } from "@/features/core/local-os";

export type ContentLibraryStatusFilter = "ALL" | ContentDraft["status"];

export type ContentLibraryLocationState = {
  status: ContentLibraryStatusFilter;
  folderId: string;
  draftId: string;
  editMode: boolean;
};

export function parseContentLibraryLocation(search: string): ContentLibraryLocationState {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const status = params.get("status");
  const folderId = params.get("folder");
  const draftId = params.get("draft");
  const editMode = params.get("edit") === "true";

  const normalizedStatus = (status || "").trim().toLowerCase();
  const parsedStatus: ContentLibraryStatusFilter =
    normalizedStatus === "draft" || normalizedStatus === "awaiting-approval"
      ? "DRAFT"
      : normalizedStatus === "approved"
        ? "APPROVED"
        : "ALL";

  return {
    status: parsedStatus,
    folderId: folderId && folderId.trim() ? folderId.trim() : "ALL",
    draftId: draftId && draftId.trim() ? draftId.trim() : "",
    editMode,
  };
}

export function buildContentLibraryLocation(state: Partial<ContentLibraryLocationState>): string {
  const params = new URLSearchParams();
  const status = state.status || "ALL";
  const folderId = state.folderId || "ALL";

  if (status !== "ALL") params.set("status", status === "DRAFT" ? "awaiting-approval" : status.toLowerCase());
  if (folderId !== "ALL") params.set("folder", folderId);
  if (state.draftId) params.set("draft", state.draftId);
  if (state.editMode) params.set("edit", "true");

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildCalendarDraftUrl(draftId: string): string {
  const cleanDraftId = draftId.trim();
  return cleanDraftId ? `/calendar?draft=${encodeURIComponent(cleanDraftId)}` : "/calendar";
}