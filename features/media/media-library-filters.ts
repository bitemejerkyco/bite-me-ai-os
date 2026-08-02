export type MediaCardCategory = "image" | "video" | "audio" | "document" | "file";
export type AssetTypeFilter = "ALL" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
export type SourceFilter = "ALL" | "UPLOADED" | "GENERATED" | "IMPORTED" | "UGC" | "CAMPAIGN";

export function sourceBadge(source: string | undefined): string {
  switch ((source || "").toUpperCase()) {
    case "GENERATED":
      return "AI Generated";
    case "IMPORTED":
      return "Imported";
    case "UGC":
      return "UGC";
    case "CAMPAIGN":
      return "Campaign";
    case "LEGACY":
      return "Legacy";
    default:
      return "Uploaded";
  }
}

export function matchesTypeFilter(
  category: MediaCardCategory,
  typeFilter: AssetTypeFilter,
): boolean {
  if (typeFilter === "ALL") return true;
  if (typeFilter === "IMAGE") return category === "image";
  if (typeFilter === "VIDEO") return category === "video";
  if (typeFilter === "AUDIO") return category === "audio";
  return category === "document" || category === "file";
}

export function matchesSourceFilter(source: string | undefined, sourceFilter: SourceFilter): boolean {
  if (sourceFilter === "ALL") return true;
  return (source || "UPLOADED").toUpperCase() === sourceFilter;
}
