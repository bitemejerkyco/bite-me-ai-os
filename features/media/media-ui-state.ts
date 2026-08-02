export type MediaUiState = {
  folderFilter: string;
  query: string;
  typeFilter: "ALL" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  sourceFilter: "ALL" | "UPLOADED" | "GENERATED" | "IMPORTED" | "UGC" | "CAMPAIGN";
  sortBy: "NEWEST" | "OLDEST" | "NAME" | "SIZE";
  favoriteOnly: boolean;
  showArchived: boolean;
  viewMode: "grid" | "list";
};

export const DEFAULT_MEDIA_UI_STATE: MediaUiState = {
  folderFilter: "ALL",
  query: "",
  typeFilter: "ALL",
  sourceFilter: "ALL",
  sortBy: "NEWEST",
  favoriteOnly: false,
  showArchived: false,
  viewMode: "grid",
};

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function parseMediaUiState(raw: string | null | undefined): MediaUiState {
  if (!raw) return { ...DEFAULT_MEDIA_UI_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<MediaUiState>;
    return {
      folderFilter: asString(parsed.folderFilter, DEFAULT_MEDIA_UI_STATE.folderFilter),
      query: typeof parsed.query === "string" ? parsed.query : DEFAULT_MEDIA_UI_STATE.query,
      typeFilter: (["ALL", "IMAGE", "VIDEO", "AUDIO", "DOCUMENT"] as const).includes(parsed.typeFilter as never)
        ? (parsed.typeFilter as MediaUiState["typeFilter"])
        : DEFAULT_MEDIA_UI_STATE.typeFilter,
      sourceFilter: (["ALL", "UPLOADED", "GENERATED", "IMPORTED", "UGC", "CAMPAIGN"] as const).includes(parsed.sourceFilter as never)
        ? (parsed.sourceFilter as MediaUiState["sourceFilter"])
        : DEFAULT_MEDIA_UI_STATE.sourceFilter,
      sortBy: (["NEWEST", "OLDEST", "NAME", "SIZE"] as const).includes(parsed.sortBy as never)
        ? (parsed.sortBy as MediaUiState["sortBy"])
        : DEFAULT_MEDIA_UI_STATE.sortBy,
      favoriteOnly: asBool(parsed.favoriteOnly, DEFAULT_MEDIA_UI_STATE.favoriteOnly),
      showArchived: asBool(parsed.showArchived, DEFAULT_MEDIA_UI_STATE.showArchived),
      viewMode: parsed.viewMode === "list" ? "list" : "grid",
    };
  } catch {
    return { ...DEFAULT_MEDIA_UI_STATE };
  }
}
