"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import { SUCCESS_MESSAGES } from "@/features/help/success-messages";
import {
  saveLocal,
  STORAGE_KEYS,
  type ContentDraft,
  type LibraryFolder,
  type MediaAsset,
  type ScheduledPost,
} from "@/features/core/local-os";
import type { TikTokConnectionView } from "@/features/integrations/tiktok/types";
import {
  createCloudFolder,
  loadCloudDrafts,
  loadCloudSchedule,
  moveCloudMediaToFolder,
  removeCloudMedia,
  renameCloudFolder,
  updateCloudMediaAsset,
  uploadCloudMedia,
} from "@/features/core/cloud-store";
import {
  matchesSourceFilter,
  matchesTypeFilter,
  sourceBadge,
  type AssetTypeFilter,
  type SourceFilter,
} from "@/features/media/media-library-filters";
import {
  DEFAULT_MEDIA_UI_STATE,
  parseMediaUiState,
} from "@/features/media/media-ui-state";
import {
  nextResolveRefreshInMs,
  selectAssetIdsNeedingResolve,
} from "@/features/media/resolve-cache";
import {
  extractFileNameFromDisposition,
  isLikelyExpiredSignedUrlFailure,
} from "@/features/media/download-utils";
import {
  applyArchiveUpdate,
  applyFavoriteUpdate,
} from "@/features/media/media-asset-updates";
import { isExplicitProductAsset } from "@/features/core/product-asset-selector";
import {
  DEFAULT_MEDIA_CAPABILITIES,
  type MediaCapabilities,
} from "@/features/media/media-capabilities";

type ResolvedAsset = {
  assetId: string;
  previewUrl: string;
  downloadUrl: string;
  thumbnailUrl: string;
  expiresAt: string | null;
  mimeType: string;
  isDownloadAllowed: boolean;
  fileName: string;
  assetType: string;
  createdAt: string;
  source: string;
  generationStatus: string;
  generationJobId: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  sizeBytes: number;
  folderId: string | null;
  tags: string[];
  campaignIds: string[];
  creatorName: string | null;
  usageRightsStart: string | null;
  usageRightsEnd: string | null;
  usageRightsStatus: "NONE" | "ACTIVE" | "EXPIRING" | "EXPIRED";
  approvalStatus: string | null;
  label: "generated" | "uploaded" | "imported" | "legacy";
  error: string | null;
};

type ResolvePayload = {
  ok?: boolean;
  assets?: ResolvedAsset[];
};

type SortFilter = "NEWEST" | "OLDEST" | "NAME" | "SIZE";
type MediaLibraryTab = "ALL_MEDIA" | "VIDEOS" | "IMAGES" | "CONTENT_DRAFTS" | "APPROVED" | "PUBLISHED";
const VIEW_MODE_KEY = "postmotive:media:view-mode";
const MEDIA_UI_STATE_KEY = "postmotive:media:ui-state";
const PAGE_SIZE = 24;
let tiktokStatusRequest: Promise<TikTokConnectionView | null> | null = null;

function normalizeMediaTab(value: unknown): MediaLibraryTab {
  if (value === "VIDEOS") return "VIDEOS";
  if (value === "IMAGES") return "IMAGES";
  if (value === "CONTENT_DRAFTS") return "CONTENT_DRAFTS";
  if (value === "APPROVED") return "APPROVED";
  if (value === "PUBLISHED") return "PUBLISHED";
  return "ALL_MEDIA";
}

function getTiktokStatusOnce(): Promise<TikTokConnectionView | null> {
  if (!tiktokStatusRequest) {
    tiktokStatusRequest = fetch("/api/integrations/tiktok/status", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok?: boolean;
          data?: TikTokConnectionView;
        };
        if (response.ok && payload.ok && payload.data) {
          return payload.data;
        }
        return null;
      })
      .catch(() => null);
  }
  return tiktokStatusRequest;
}

function tagsFor(file: File): string[] {
  const tags = [file.type.split("/")[0] || "asset"];
  const name = file.name.toLowerCase();
  if (name.includes("logo")) tags.push("logo");
  if (name.includes("product")) tags.push("product");
  if (name.includes("social")) tags.push("social");
  return [...new Set(tags)];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const whole = Math.floor(seconds);
  const mm = Math.floor(whole / 60);
  const ss = whole % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function mimeCategory(asset: MediaAsset, resolved?: ResolvedAsset): "image" | "video" | "audio" | "document" | "file" {
  const mime = (resolved?.mimeType || asset.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("pdf") || mime.includes("document") || mime.includes("text")) return "document";
  return "file";
}

function extensionFor(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
}

function readViewMode(): "grid" | "list" {
  if (typeof window === "undefined") return "grid";
  const stored = window.localStorage.getItem(VIEW_MODE_KEY);
  return stored === "list" ? "list" : "grid";
}

function readMediaUiState() {
  if (typeof window === "undefined") return { ...DEFAULT_MEDIA_UI_STATE };
  return parseMediaUiState(window.localStorage.getItem(MEDIA_UI_STATE_KEY));
}

async function inferFileMetadata(file: File): Promise<{
  width?: number;
  height?: number;
  durationSeconds?: number;
}> {
  if (file.type.startsWith("image/")) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
        URL.revokeObjectURL(url);
      };
      image.onerror = () => {
        resolve({});
        URL.revokeObjectURL(url);
      };
      image.src = url;
    });
  }

  if (file.type.startsWith("video/")) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve({
          width: Number.isFinite(video.videoWidth) ? video.videoWidth : undefined,
          height: Number.isFinite(video.videoHeight) ? video.videoHeight : undefined,
          durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
        });
        URL.revokeObjectURL(url);
      };
      video.onerror = () => {
        resolve({});
        URL.revokeObjectURL(url);
      };
      video.src = url;
    });
  }

  return {};
}

type MediaLibraryProps = {
  initialAssets?: MediaAsset[];
  initialFolders?: LibraryFolder[];
  initialRoleLabel?: string;
  initialCapabilities?: MediaCapabilities;
  initialTab?: string;
};

export default function MediaLibrary({
  initialAssets = [],
  initialFolders = [],
  initialRoleLabel = "GUEST",
  initialCapabilities = DEFAULT_MEDIA_CAPABILITIES,
  initialTab,
}: MediaLibraryProps) {
  const persistedUiState = useMemo(() => readMediaUiState(), []);

  const [assets, setAssets] = useState<MediaAsset[]>(initialAssets);
  const [folders, setFolders] = useState<LibraryFolder[]>(initialFolders);
  const [folderFilter, setFolderFilter] = useState(persistedUiState.folderFilter);
  const [newFolderName, setNewFolderName] = useState("");
  const [query, setQuery] = useState(persistedUiState.query);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [tiktokView, setTikTokView] = useState<TikTokConnectionView | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(persistedUiState.viewMode || readViewMode());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolvedMap, setResolvedMap] = useState<Record<string, ResolvedAsset>>({});
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>(persistedUiState.typeFilter);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(persistedUiState.sourceFilter);
  const [sortBy, setSortBy] = useState<SortFilter>(persistedUiState.sortBy);
  const [favoriteOnly, setFavoriteOnly] = useState(persistedUiState.favoriteOnly);
  const [showArchived, setShowArchived] = useState(persistedUiState.showArchived);
  const [activeTab, setActiveTab] = useState<MediaLibraryTab>(normalizeMediaTab(initialTab));
  const [contentDrafts, setContentDrafts] = useState<ContentDraft[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const roleLabel = initialRoleLabel;
  const capabilities: MediaCapabilities = initialCapabilities;
  const [resolveRefreshRevision, setResolveRefreshRevision] = useState(0);

  const resolveCacheRef = useRef<Record<string, ResolvedAsset>>({});
  const inflightResolveRef = useRef<Set<string>>(new Set());
  const resolveRefreshTimerRef = useRef<number | null>(null);

  const previewCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", next);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      MEDIA_UI_STATE_KEY,
      JSON.stringify({
        folderFilter,
        query,
        typeFilter,
        sourceFilter,
        sortBy,
        favoriteOnly,
        showArchived,
        viewMode,
      }),
    );
  }, [favoriteOnly, folderFilter, query, showArchived, sortBy, sourceFilter, typeFilter, viewMode]);

  useEffect(() => {
    let cancelled = false;
    const tiktokStatusPromise = getTiktokStatusOnce();
    void tiktokStatusPromise
      .then((payload) => {
        if (cancelled || !payload) return;
        setTikTokView(payload);
      })
      .catch(() => {
        // The library remains usable even if TikTok status cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadCloudDrafts(), loadCloudSchedule()])
      .then(([drafts, posts]) => {
        if (cancelled) return;
        setContentDrafts(drafts);
        setScheduledPosts(posts);
      })
      .catch(() => {
        if (cancelled) return;
        setContentDrafts([]);
        setScheduledPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTab = (tab: MediaLibraryTab) => {
    setActiveTab(tab);
    if (tab === "VIDEOS") {
      setTypeFilter("VIDEO");
      setSourceFilter("ALL");
      setFolderFilter("ALL");
      setShowArchived(false);
      setFavoriteOnly(false);
      return;
    }
    if (tab === "IMAGES") {
      setTypeFilter("IMAGE");
      setSourceFilter("ALL");
      setFolderFilter("ALL");
      setShowArchived(false);
      setFavoriteOnly(false);
      return;
    }
    if (tab === "ALL_MEDIA") {
      setTypeFilter("ALL");
      setSourceFilter("ALL");
      setFolderFilter("ALL");
      setShowArchived(false);
      setFavoriteOnly(false);
    }
  };

  const filtered = useMemo(() => {
    const base = assets.filter((asset) => {
      const resolved = resolvedMap[asset.id];
      const category = mimeCategory(asset, resolved);
      const normalized = `${asset.name} ${(resolved?.tags || asset.tags).join(" ")} ${resolved?.creatorName || ""}`.toLowerCase();
      const matchesSearch = !debouncedQuery || normalized.includes(debouncedQuery);
      const matchesFolder = folderFilter === "ALL" ? true : (asset.folderId || "") === folderFilter;
      const matchesType = matchesTypeFilter(category, typeFilter);
      const matchesSource = matchesSourceFilter(resolved?.source || asset.source, sourceFilter);
      const matchesFavorite = favoriteOnly ? Boolean(asset.isFavorite) : true;
      const matchesArchived = showArchived ? Boolean(asset.archivedAt) : !asset.archivedAt;
      return (
        matchesSearch &&
        matchesFolder &&
        matchesType &&
        matchesSource &&
        matchesFavorite &&
        matchesArchived
      );
    });

    const sorted = [...base];
    if (sortBy === "NAME") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "SIZE") {
      sorted.sort((a, b) => b.size - a.size);
    } else if (sortBy === "OLDEST") {
      sorted.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    } else {
      sorted.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    return sorted;
  }, [
    assets,
    debouncedQuery,
    favoriteOnly,
    folderFilter,
    resolvedMap,
    showArchived,
    sortBy,
    sourceFilter,
    typeFilter,
  ]);

  const filteredContentDrafts = useMemo(() => {
    if (activeTab === "APPROVED") {
      return contentDrafts.filter((draft) => draft.status === "APPROVED");
    }
    return contentDrafts.filter((draft) => draft.status === "DRAFT");
  }, [activeTab, contentDrafts]);

  const publishedPosts = useMemo(
    () => scheduledPosts.filter((post) => post.status === "PUBLISHED"),
    [scheduledPosts],
  );

  const visibleAssets = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const visibleAssetIdKey = useMemo(
    () => visibleAssets.map((asset) => asset.id).join("|"),
    [visibleAssets],
  );

  useEffect(() => {
    const visibleAssetIds = visibleAssetIdKey ? visibleAssetIdKey.split("|") : [];
    if (!visibleAssetIds.length) return;

    const hydratedFromCache: Record<string, ResolvedAsset> = {};
    for (const assetId of visibleAssetIds) {
      const cached = resolveCacheRef.current[assetId];
      if (cached) {
        hydratedFromCache[assetId] = cached;
      }
    }
    if (Object.keys(hydratedFromCache).length) {
      const rafId = window.requestAnimationFrame(() => {
        setResolvedMap((current) => ({ ...current, ...hydratedFromCache }));
      });

      return () => window.cancelAnimationFrame(rafId);
    }

    const idsToResolve = selectAssetIdsNeedingResolve({
      visibleAssetIds,
      cachedById: resolveCacheRef.current,
      inflightAssetIds: inflightResolveRef.current,
    });

    if (!idsToResolve.length) return;
    idsToResolve.forEach((assetId) => inflightResolveRef.current.add(assetId));

    void fetch("/api/media/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetIds: idsToResolve }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as ResolvePayload;
        if (!response.ok || !payload.ok || !payload.assets) {
          throw new Error("preview-resolve-failed");
        }
        const next: Record<string, ResolvedAsset> = {};
        for (const item of payload.assets) {
          next[item.assetId] = item;
          resolveCacheRef.current[item.assetId] = item;
        }
        setResolvedMap((current) => ({ ...current, ...next }));
      })
      .catch(() => {
        // Keep cards visible with placeholders when secure URL resolution fails.
      })
      .finally(() => {
        idsToResolve.forEach((assetId) => inflightResolveRef.current.delete(assetId));
      });
  }, [resolveRefreshRevision, visibleAssetIdKey]);

  useEffect(() => {
    if (resolveRefreshTimerRef.current !== null) {
      window.clearTimeout(resolveRefreshTimerRef.current);
      resolveRefreshTimerRef.current = null;
    }

    const visibleAssetIds = visibleAssetIdKey ? visibleAssetIdKey.split("|") : [];
    if (!visibleAssetIds.length) return;

    const refreshInMs = nextResolveRefreshInMs({
      visibleAssetIds,
      cachedById: resolveCacheRef.current,
    });
    if (refreshInMs === null) return;

    resolveRefreshTimerRef.current = window.setTimeout(() => {
      setResolveRefreshRevision((current) => current + 1);
    }, refreshInMs);

    return () => {
      if (resolveRefreshTimerRef.current !== null) {
        window.clearTimeout(resolveRefreshTimerRef.current);
        resolveRefreshTimerRef.current = null;
      }
    };
  }, [visibleAssetIdKey]);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    setMessage("");
    try {
      const folder = await createCloudFolder("MEDIA", newFolderName);
      setFolders((current) => [...current, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setFolderFilter(folder.id);
      setNewFolderName("");
      setMessage(`Folder \"${folder.name}\" created.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to create folder.");
    }
  };

  const renameFolder = async (folder: LibraryFolder) => {
    const name = window.prompt("Rename folder", folder.name);
    if (!name || name.trim() === folder.name) return;
    try {
      const updated = await renameCloudFolder(folder, name);
      setFolders((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setMessage(`Folder renamed to \"${updated.name}\".`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to rename folder.");
    }
  };

  const moveAsset = async (asset: MediaAsset, folderId: string) => {
    if (!capabilities.canMoveFolder) return;
    setMessage("");
    try {
      await moveCloudMediaToFolder(asset.id, folderId || undefined);
      const updated = { ...asset, folderId: folderId || undefined };
      const next = assets.map((item) => (item.id === asset.id ? updated : item));
      setAssets(next);
      saveLocal(STORAGE_KEYS.media, next);
      setMessage(folderId ? "Asset moved." : "Asset moved to Unfiled.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to move asset.");
    }
  };

  const renameAsset = async (asset: MediaAsset) => {
    if (!capabilities.canRename) return;
    const name = window.prompt("Rename asset", asset.name);
    if (!name || name.trim() === asset.name) return;
    try {
      await updateCloudMediaAsset(asset.id, { name: name.trim() });
      setAssets((current) =>
        current.map((item) => (item.id === asset.id ? { ...item, name: name.trim() } : item)),
      );
      setMessage("Asset renamed.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to rename asset.");
    }
  };

  const addTags = async (asset: MediaAsset) => {
    if (!capabilities.canEditTags) return;
    const existing = asset.tags.join(", ");
    const value = window.prompt("Edit tags (comma separated)", existing);
    if (value === null) return;
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    try {
      await updateCloudMediaAsset(asset.id, { tags });
      setAssets((current) => current.map((item) => (item.id === asset.id ? { ...item, tags } : item)));
      setMessage("Tags updated.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to update tags.");
    }
  };

  const editProductAsset = async (asset: MediaAsset) => {
    if (!capabilities.canEditTags || !isExplicitProductAsset(asset)) return;
    const current = asset.productMetadata || {};
    const productName = window.prompt("Product name", current.productName || asset.name);
    if (productName === null) return;
    const productId = window.prompt("Product ID", current.productId || "");
    if (productId === null) return;
    const role = window.prompt("Product role (PRIMARY, ALTERNATE, REFERENCE)", current.role || "PRIMARY");
    if (role === null) return;
    const angle = window.prompt("Product angle", current.angle || "FRONT");
    if (angle === null) return;
    const background = window.prompt("Product background", current.background || "brand-safe neutral background");
    if (background === null) return;
    const position = window.prompt("Product position", current.position || "center frame");
    if (position === null) return;
    const scale = window.prompt("Product scale", current.scale || "large and readable");
    if (scale === null) return;
    const safeArea = window.prompt("Product safe area", current.safeArea || "leave room for overlays");
    if (safeArea === null) return;
    const approvedForGeneration = window.confirm("Approve this image for exact product generation?");
    const locked = window.confirm("Lock the product asset so it cannot be visually rewritten?");
    const exactProductMode = window.confirm("Mark this as the default exact-product asset?");
    const allowAiMotion = window.confirm("Allow AI product motion for this asset with explicit confirmation?");
    const preserveOriginalAsset = window.confirm("Preserve the original uploaded file path?");
    const nextMetadata: NonNullable<MediaAsset["productMetadata"]> = {
      productId: productId.trim() || undefined,
      productName: productName.trim() || undefined,
      assetRole: (role === "ALTERNATE" || role === "REFERENCE" ? role : "PRIMARY") as NonNullable<MediaAsset["productMetadata"]>["assetRole"],
      isPrimaryProductImage: (role === "ALTERNATE" || role === "REFERENCE") ? false : true,
      role: (role === "ALTERNATE" || role === "REFERENCE" ? role : "PRIMARY") as NonNullable<MediaAsset["productMetadata"]>["role"],
      angle: angle.trim() || undefined,
      locked,
      approvedForGeneration,
      transparentBackground: true,
      originalAssetId: asset.id,
      exactProductMode,
      allowAiMotion,
      preserveOriginalAsset,
      originalStoragePath: asset.storagePath,
      background: background.trim() || undefined,
      position: position.trim() || undefined,
      scale: scale.trim() || undefined,
      safeArea: safeArea.trim() || undefined,
      notes: "Locked product asset for exact product generation.",
    };
    try {
      await updateCloudMediaAsset(asset.id, { productMetadata: nextMetadata });
      setAssets((currentAssets) =>
        currentAssets.map((item) =>
          item.id === asset.id ? { ...item, productMetadata: nextMetadata } : item,
        ),
      );
      setMessage("Product metadata saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to update product metadata.");
    }
  };

  const toggleFavorite = async (asset: MediaAsset) => {
    if (!capabilities.canFavorite) return;
    const nextFavorite = !asset.isFavorite;
    try {
      await updateCloudMediaAsset(asset.id, { isFavorite: nextFavorite });
      setAssets((current) => applyFavoriteUpdate(current, asset.id, nextFavorite));
      setMessage(nextFavorite ? "Added to favorites." : "Removed from favorites.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to update favorite state.");
    }
  };

  const archiveAsset = async (asset: MediaAsset) => {
    if (!capabilities.canArchive) return;
    if (!window.confirm(`Archive ${asset.name}?`)) return;
    const archivedAt = new Date().toISOString();
    try {
      await updateCloudMediaAsset(asset.id, { archivedAt });
      setAssets((current) => applyArchiveUpdate(current, asset.id, archivedAt));
      setMessage("Asset archived.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to archive asset.");
    }
  };

  const restoreAsset = async (asset: MediaAsset) => {
    if (!capabilities.canArchive) return;
    try {
      await updateCloudMediaAsset(asset.id, { archivedAt: null });
      setAssets((current) => applyArchiveUpdate(current, asset.id, null));
      setMessage("Asset restored.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to restore asset.");
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setMessage("Uploading securely...");
    try {
      const added: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        const meta = await inferFileMetadata(file);
        added.push(
          await uploadCloudMedia(file, tagsFor(file), folderFilter !== "ALL" ? folderFilter : undefined, {
            source: "UPLOADED",
            generationStatus: "READY",
            width: meta.width,
            height: meta.height,
            durationSeconds: meta.durationSeconds,
          }),
        );
      }
      const next = [...added, ...assets];
      setAssets(next);
      saveLocal(STORAGE_KEYS.media, next);
      const success = SUCCESS_MESSAGES.mediaUploaded();
      setMessage(`${success.title} ${success.detail}`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (asset: MediaAsset) => {
    if (!capabilities.canDelete) return;
    if (!window.confirm(`Permanently delete ${asset.name}? This cannot be undone.`)) return;
    setMessage("");
    try {
      await removeCloudMedia(asset);
      const next = assets.filter((item) => item.id !== asset.id);
      setAssets(next);
      saveLocal(STORAGE_KEYS.media, next);
      setMessage("Asset deleted.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to remove asset.");
    }
  };

  const openPreview = (assetId: string) => {
    setPreviewAssetId(assetId);
    setZoom(1);
  };

  const closePreview = useCallback(() => {
    setPreviewAssetId(null);
    setZoom(1);
  }, []);

  const selectedCount = selectedIds.size;
  const isContentTab = activeTab === "CONTENT_DRAFTS" || activeTab === "APPROVED" || activeTab === "PUBLISHED";

  const toggleSelection = (assetId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(visibleAssets.map((asset) => asset.id)));
  };

  const downloadAsset = async (assetId: string, retryAttempted = false): Promise<void> => {
    const resolved = resolvedMap[assetId];
    if (!resolved?.isDownloadAllowed) {
      setMessage("Download unavailable for this item.");
      return;
    }

    const response = await fetch(resolved.downloadUrl, {
      cache: "no-store",
      credentials: "include",
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      if (!retryAttempted && isLikelyExpiredSignedUrlFailure(response.status, bodyText)) {
        await retryResolve(assetId);
        await downloadAsset(assetId, true);
        return;
      }
      setMessage("Unable to download this file.");
      return;
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition");
    const safeName = extractFileNameFromDisposition(disposition) || resolved.fileName || "media-asset";
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const copySecureLink = async (assetId: string) => {
    const resolved = resolvedMap[assetId];
    if (!resolved?.previewUrl) {
      setMessage("Secure link unavailable. Retry preview resolution.");
      return;
    }
    try {
      await navigator.clipboard.writeText(resolved.previewUrl);
      setMessage("Secure preview link copied.");
    } catch {
      setMessage("Unable to copy secure link.");
    }
  };

  const copyAssetId = async (assetId: string) => {
    try {
      await navigator.clipboard.writeText(assetId);
      setMessage("Asset ID copied.");
    } catch {
      setMessage("Unable to copy asset ID.");
    }
  };

  const retryResolve = async (assetId: string) => {
    try {
      if (inflightResolveRef.current.has(assetId)) return;
      inflightResolveRef.current.add(assetId);

      const response = await fetch("/api/media/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetIds: [assetId] }),
      });
      const payload = (await response.json()) as ResolvePayload;
      if (!response.ok || !payload.ok || !payload.assets?.length) {
        throw new Error("resolve-failed");
      }
      resolveCacheRef.current[assetId] = payload.assets![0];
      setResolvedMap((current) => ({ ...current, [assetId]: payload.assets![0] }));
      setBrokenIds((current) => {
        const next = new Set(current);
        next.delete(assetId);
        return next;
      });
      setMessage("Preview refreshed.");
    } catch {
      setMessage("Preview unavailable.");
    } finally {
      inflightResolveRef.current.delete(assetId);
    }
  };

  const changeViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VIEW_MODE_KEY, mode);
    }
  };

  const previewIndex = previewAssetId ? filtered.findIndex((item) => item.id === previewAssetId) : -1;
  const previewAsset = previewIndex >= 0 ? filtered[previewIndex] : null;
  const previewResolved = previewAsset ? resolvedMap[previewAsset.id] : undefined;

  const openPreviousPreview = useCallback(() => {
    if (previewIndex <= 0) return;
    openPreview(filtered[previewIndex - 1]!.id);
  }, [filtered, previewIndex]);

  const openNextPreview = useCallback(() => {
    if (previewIndex < 0 || previewIndex >= filtered.length - 1) return;
    openPreview(filtered[previewIndex + 1]!.id);
  }, [filtered, previewIndex]);

  useEffect(() => {
    if (!previewAssetId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewAssetId]);

  useEffect(() => {
    if (!previewAssetId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        openPreviousPreview();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        openNextPreview();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    previewCloseRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePreview, openNextPreview, openPreviousPreview, previewAssetId]);

  useEffect(() => {
    return () => {
      if (resolveRefreshTimerRef.current !== null) {
        window.clearTimeout(resolveRefreshTimerRef.current);
        resolveRefreshTimerRef.current = null;
      }
      document.body.style.overflow = "";
    };
  }, []);

  const canLoadMore = filtered.length > visibleCount;

  return (
    <div className="space-y-5">
      <section
        data-help="media-upload-zone"
        className={`rounded-3xl border border-dashed p-6 text-center transition ${
          isDragOver ? "border-violet-500 bg-violet-100" : "border-violet-300 bg-violet-50"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          void upload(event.dataTransfer.files);
        }}
      >
        <h2 className="text-xl font-bold">Upload branded media</h2>
        <p className="mt-2 text-sm text-slate-500">Images, videos, audio, and PDFs for secure reuse across workflows.</p>
        <label className={`mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500 ${uploading ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
          {uploading ? "Uploading..." : "Choose files"}
          <input
            type="file"
            multiple
            disabled={uploading}
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,video/mp4,video/mov,video/webm,video/m4v,audio/mp3,audio/wav,audio/m4a,.pdf"
            onChange={(event) => void upload(event.target.files)}
            className="hidden"
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">Drag and drop files anywhere in this area.</p>
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {assets.length ? (
          <Link
            href="/studio"
            className="mt-4 inline-block rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
          >
            Create content with these assets {"->"}
          </Link>
        ) : null}
      </section>

      <section data-help="media-folders" className="rounded-3xl border border-slate-200/80 bg-white/80 p-5">
        <div className="mb-5 grid gap-4 border-b border-slate-200/70 pb-5 lg:grid-cols-[260px_1fr]">
          <div>
            <h2 className="font-bold">Folders</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void createFolder();
                }}
                placeholder="New folder"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <button
                disabled={!newFolderName.trim()}
                onClick={() => void createFolder()}
                className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
          <div className="flex flex-wrap content-start gap-2">
            <button
              onClick={() => {
                setFolderFilter("ALL");
                setVisibleCount(PAGE_SIZE);
                setSelectedIds(new Set());
              }}
              className={`rounded-xl border px-3 py-2 text-sm ${
                folderFilter === "ALL"
                  ? "border-violet-300 bg-violet-100 font-semibold text-violet-700"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              All folders
            </button>
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`flex items-center rounded-xl border ${
                  folderFilter === folder.id
                    ? "border-violet-300 bg-violet-100 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <button
                  onClick={() => {
                    setFolderFilter(folder.id);
                    setVisibleCount(PAGE_SIZE);
                    setSelectedIds(new Set());
                  }}
                  className="px-3 py-2 text-sm"
                >
                  Gû¦ {folder.name}
                </button>
                <button
                  onClick={() => void renameFolder(folder)}
                  className="border-l border-current/10 px-2 py-2 text-xs opacity-70"
                  aria-label={`Rename ${folder.name}`}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold">Media intelligence library</h2>
            <p className="text-sm text-slate-500">{assets.length} total assets -+ role {roleLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => changeViewMode("grid")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${viewMode === "grid" ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => changeViewMode("list")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${viewMode === "list" ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              List
            </button>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Search filename, tags, creator"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {([
            { key: "ALL_MEDIA", label: "All media" },
            { key: "VIDEOS", label: "Videos" },
            { key: "IMAGES", label: "Images" },
            { key: "CONTENT_DRAFTS", label: "Content drafts" },
            { key: "APPROVED", label: "Approved" },
            { key: "PUBLISHED", label: "Published" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTab(tab.key)}
              className={`rounded-xl border px-3 py-2 text-sm ${activeTab === tab.key
                ? "border-violet-300 bg-violet-100 font-semibold text-violet-700"
                : "border-slate-200 bg-white text-slate-700"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!isContentTab ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AssetTypeFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="ALL">All types</option>
            <option value="IMAGE">Images</option>
            <option value="VIDEO">Videos</option>
            <option value="AUDIO">Audio</option>
            <option value="DOCUMENT">Documents</option>
          </select>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="ALL">All sources</option>
            <option value="UPLOADED">Uploaded</option>
            <option value="GENERATED">AI Generated</option>
            <option value="IMPORTED">Imported</option>
            <option value="UGC">UGC</option>
            <option value="CAMPAIGN">Campaign</option>
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="NEWEST">Newest</option>
            <option value="OLDEST">Oldest</option>
            <option value="NAME">Name</option>
            <option value="SIZE">File size</option>
          </select>
          <button type="button" onClick={() => setFavoriteOnly((value) => !value)} className={`rounded-xl border px-3 py-2 text-sm ${favoriteOnly ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700"}`}>
            Favorites {favoriteOnly ? "On" : "Off"}
          </button>
          <button type="button" onClick={() => setShowArchived((value) => !value)} className={`rounded-xl border px-3 py-2 text-sm ${showArchived ? "border-slate-600 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
            {showArchived ? "Viewing archived" : "Active assets"}
          </button>
          <button type="button" onClick={() => {
            setTypeFilter("ALL");
            setSourceFilter("ALL");
            setSortBy("NEWEST");
            setFavoriteOnly(false);
            setFolderFilter("ALL");
            setQuery("");
            setVisibleCount(PAGE_SIZE);
          }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            Reset filters
          </button>
        </div>
        ) : null}

        {!isContentTab && selectedCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="font-semibold">{selectedCount} selected</span>
            <button type="button" onClick={selectAllVisible} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">Select visible</button>
            <button
              type="button"
              onClick={() => {
                if (selectedCount === 1) {
                  const only = [...selectedIds][0];
                  if (only) void downloadAsset(only);
                  return;
                }
                setMessage("Bulk ZIP download coming soon. Download items individually.");
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5"
            >
              Download
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">Clear selection</button>
          </div>
        ) : null}

        {isContentTab ? (
          activeTab === "PUBLISHED" ? (
            publishedPosts.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No published posts yet.
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                {publishedPosts.map((post) => (
                  <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{post.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{post.channel} · Published {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "recently"}</p>
                      </div>
                      <Link href="/calendar" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">Open calendar</Link>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : filteredContentDrafts.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {activeTab === "APPROVED" ? "No approved drafts yet." : "No content drafts yet."}
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {filteredContentDrafts.map((draft) => (
                <article key={draft.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{draft.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{draft.channel} · {draft.status} · {new Date(draft.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/calendar?draft=${encodeURIComponent(draft.id)}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">Open</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="mt-6"><GuidedEmptyState title="Your Media Library is empty" description="Upload your logo, product photos, videos, and brand assets so PostMotive can create more accurate branded content." estimatedTime="2-4 minutes" primaryAction={{ label: "Upload Media", href: "/media" }} secondaryAction={{ label: "Create Folder", href: "/media" }} /></div>
        ) : viewMode === "grid" ? (
          <div data-help="media-asset-grid" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleAssets.map((asset) => {
              const resolved = resolvedMap[asset.id];
              const category = mimeCategory(asset, resolved);
              const previewUnavailable = Boolean(resolved?.error) || brokenIds.has(asset.id);
              const thumbUrl = resolved?.thumbnailUrl || "";
              const duration = formatDuration(resolved?.durationSeconds ?? asset.durationSeconds);
              const dimensions = resolved?.width && resolved?.height ? `${resolved.width}x${resolved.height}` : "";
              const folderName = folders.find((folder) => folder.id === asset.folderId)?.name || "Unfiled";
              const metadataLoading = !resolved;

              return (
                <article key={asset.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm">
                  <div className="relative">
                    <input
                      aria-label={`Select ${asset.name}`}
                      type="checkbox"
                      checked={selectedIds.has(asset.id)}
                      onChange={() => toggleSelection(asset.id)}
                      className="absolute left-3 top-3 z-20 h-4 w-4 rounded border-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => openPreview(asset.id)}
                      className="group relative block aspect-video w-full overflow-hidden bg-slate-100 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      {metadataLoading ? <div className="absolute inset-0 animate-pulse bg-slate-200" /> : null}

                      {category === "image" && thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={asset.name || "Media image"}
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={() => setBrokenIds((current) => new Set(current).add(asset.id))}
                        />
                      ) : null}

                      {category === "video" && thumbUrl ? (
                        <>
                          <img
                            src={thumbUrl}
                            alt={asset.name || "Video preview"}
                            loading="lazy"
                            className="h-full w-full object-cover"
                            onError={() => setBrokenIds((current) => new Set(current).add(asset.id))}
                          />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 text-2xl text-white">Gû¦</span>
                          {duration ? (
                            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">{duration}</span>
                          ) : null}
                        </>
                      ) : null}

                      {(category === "file" || category === "audio" || previewUnavailable || !thumbUrl) ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-600">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold tracking-wide shadow-sm">{extensionFor(asset.name)}</span>
                          <span className="text-xs font-medium">{previewUnavailable ? "Preview unavailable" : "Customer-safe placeholder"}</span>
                        </div>
                      ) : null}
                    </button>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{asset.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {resolved?.mimeType || asset.type} -+ {formatFileSize(resolved?.sizeBytes || asset.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {asset.isFavorite ? <span className="text-amber-500" aria-label="Favorite">Gÿà</span> : null}
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase text-slate-600">{sourceBadge(resolved?.source || asset.source)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <p>Type: {category}</p>
                      <p>Status: {resolved?.generationStatus || asset.generationStatus || "READY"}</p>
                      <p>Created: {new Date(asset.createdAt).toLocaleDateString()}</p>
                      <p>Folder: {folderName}</p>
                      <p>{dimensions ? `Dimensions: ${dimensions}` : "Dimensions: -"}</p>
                      <p>{duration ? `Duration: ${duration}` : "Duration: -"}</p>
                    </div>

                    {(resolved?.tags || asset.tags).length ? (
                      <div className="flex flex-wrap gap-2">
                        {(resolved?.tags || asset.tags).slice(0, 6).map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">#{tag}</span>
                        ))}
                      </div>
                    ) : null}

                    {resolved?.usageRightsStatus === "EXPIRED" ? (
                      <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">Usage rights expired</p>
                    ) : null}
                    {resolved?.usageRightsStatus === "EXPIRING" ? (
                      <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">Usage rights expiring soon</p>
                    ) : null}
                    {isExplicitProductAsset(asset) && asset.productMetadata ? (
                      <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                        <p className="font-semibold">Locked product asset</p>
                        <p className="mt-1">{asset.productMetadata.productName || asset.name} · {asset.productMetadata.role || "PRIMARY"} · {asset.productMetadata.angle || "FRONT"}</p>
                        <p className="mt-1">{asset.productMetadata.approvedForGeneration ? "Approved for exact product generation" : "Not approved for generation"}</p>
                      </div>
                    ) : asset.createdWithLockedProduct ? (
                      <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                        <p className="font-semibold">Created with locked product</p>
                        <p className="mt-1">This asset was rendered from a locked product reference.</p>
                      </div>
                    ) : null}

                    {previewUnavailable ? (
                      <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                        <p>Preview unavailable</p>
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => void retryResolve(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">Retry</button>
                          {resolved?.isDownloadAllowed ? (
                            <button type="button" onClick={() => void downloadAsset(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">Download original</button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2 text-xs">
                      <button type="button" onClick={() => openPreview(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">View</button>
                      <button type="button" onClick={() => void downloadAsset(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">Download</button>
                      {isExplicitProductAsset(asset) ? <button type="button" onClick={() => void editProductAsset(asset)} className="rounded border border-slate-200 bg-white px-2 py-1">Product settings</button> : null}
                      {capabilities.canRename ? <button type="button" onClick={() => void renameAsset(asset)} className="rounded border border-slate-200 bg-white px-2 py-1">Rename</button> : null}
                      {capabilities.canEditTags ? <button type="button" onClick={() => void addTags(asset)} className="rounded border border-slate-200 bg-white px-2 py-1">Edit tags</button> : null}
                      {capabilities.canMoveFolder ? (
                        <select
                          value={asset.folderId || ""}
                          onChange={(event) => void moveAsset(asset, event.target.value)}
                          className="rounded border border-slate-200 bg-white px-2 py-1"
                          aria-label={`Move ${asset.name} to folder`}
                        >
                          <option value="">Move to folder</option>
                          <option value="">Unfiled</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                          ))}
                        </select>
                      ) : null}
                      {capabilities.canFavorite ? (
                        <button type="button" onClick={() => void toggleFavorite(asset)} className="rounded border border-slate-200 bg-white px-2 py-1">
                          {asset.isFavorite ? "Unfavorite" : "Favorite"}
                        </button>
                      ) : null}
                      {capabilities.canCreateWithAsset ? (
                        <Link href={`/studio?assetId=${asset.id}`} className="rounded border border-slate-200 bg-white px-2 py-1">Create with this asset</Link>
                      ) : null}
                      <button type="button" onClick={() => void copySecureLink(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">Copy secure link</button>
                      <button type="button" onClick={() => void copyAssetId(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">Copy asset ID</button>
                      {asset.archivedAt ? (
                        capabilities.canArchive ? <button type="button" onClick={() => void restoreAsset(asset)} className="rounded border border-slate-200 bg-white px-2 py-1">Restore</button> : null
                      ) : (
                        capabilities.canArchive ? <button type="button" onClick={() => void archiveAsset(asset)} className="rounded border border-slate-200 bg-white px-2 py-1">Archive</button> : null
                      )}
                      {capabilities.canDelete ? <button type="button" onClick={() => void remove(asset)} className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">Delete</button> : null}
                    </div>

                    {asset.type.startsWith("video/") ? (
                      <div className="mt-1">
                        {tiktokView?.status === "connected" && tiktokView.uploadToDraftEnabled && tiktokView.verifiedMediaReady ? (
                          <Link
                            href={`/settings/integrations/tiktok?assetId=${asset.id}`}
                            className="inline-flex rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                          >
                            Send to TikTok drafts
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400"
                          >
                            TikTok upload unavailable
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Favorite</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleAssets.map((asset) => {
                  const resolved = resolvedMap[asset.id];
                  const thumb = resolved?.thumbnailUrl || "";
                  return (
                    <tr key={asset.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 align-top">
                        <input type="checkbox" checked={selectedIds.has(asset.id)} onChange={() => toggleSelection(asset.id)} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => openPreview(asset.id)} className="flex items-center gap-3 text-left">
                          <span className="h-10 w-10 overflow-hidden rounded bg-slate-100">
                            {thumb ? (
                              <img src={thumb} alt={asset.name} loading="lazy" className="h-full w-full object-cover" onError={() => setBrokenIds((current) => new Set(current).add(asset.id))} />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">{extensionFor(asset.name)}</span>
                            )}
                          </span>
                          <span className="max-w-56 truncate font-medium">{asset.name}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2">{resolved?.mimeType || asset.type}</td>
                      <td className="px-3 py-2">{formatFileSize(resolved?.sizeBytes || asset.size)}</td>
                      <td className="px-3 py-2">{sourceBadge(resolved?.source || asset.source)}</td>
                      <td className="px-3 py-2">{asset.isFavorite ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{new Date(asset.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => openPreview(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">View</button>
                          <button type="button" onClick={() => void downloadAsset(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">Download</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canLoadMore ? (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
            >
              Load more assets
            </button>
          </div>
        ) : null}
      </section>

      {previewAsset && previewResolved ? (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/60 p-0 md:items-center md:justify-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Media preview dialog"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePreview();
            }
          }}
        >
          <div className="flex h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white md:h-[85vh] md:max-w-6xl md:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{previewAsset.name}</h3>
                <p className="text-xs text-slate-500">{previewIndex + 1} of {filtered.length}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={openPreviousPreview} disabled={previewIndex <= 0} className="rounded border border-slate-200 px-3 py-1 text-sm disabled:opacity-40">Prev</button>
                <button type="button" onClick={openNextPreview} disabled={previewIndex >= filtered.length - 1} className="rounded border border-slate-200 px-3 py-1 text-sm disabled:opacity-40">Next</button>
                <button ref={previewCloseRef} type="button" onClick={closePreview} className="rounded border border-slate-200 px-3 py-1 text-sm">Close</button>
              </div>
            </div>
            <div className="grid h-full min-h-0 lg:grid-cols-[1fr_320px]">
              <div className="relative flex min-h-0 items-center justify-center overflow-auto bg-slate-900 p-3">
                {mimeCategory(previewAsset, previewResolved) === "image" && previewResolved.previewUrl ? (
                  <img
                    src={previewResolved.previewUrl}
                    alt={previewAsset.name || "Media preview"}
                    className="max-h-full max-w-full cursor-grab"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                  />
                ) : null}
                {mimeCategory(previewAsset, previewResolved) === "video" && previewResolved.previewUrl ? (
                  <video
                    src={previewResolved.previewUrl}
                    poster={previewResolved.thumbnailUrl || undefined}
                    controls
                    className="max-h-full max-w-full"
                  />
                ) : null}
                {mimeCategory(previewAsset, previewResolved) === "file" || mimeCategory(previewAsset, previewResolved) === "audio" || mimeCategory(previewAsset, previewResolved) === "document" ? (
                  <div className="text-center text-white">
                    <p className="text-sm">Preview unavailable for this file type.</p>
                  </div>
                ) : null}
              </div>

              <aside className="min-h-0 space-y-3 overflow-y-auto border-t border-slate-200 p-4 lg:border-l lg:border-t-0">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} className="rounded border border-slate-200 px-2 py-1 text-xs">Zoom out</button>
                  <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} className="rounded border border-slate-200 px-2 py-1 text-xs">Zoom in</button>
                  <button type="button" onClick={() => setZoom(1)} className="rounded border border-slate-200 px-2 py-1 text-xs">Reset zoom</button>
                  <button type="button" onClick={() => setZoom(1)} className="rounded border border-slate-200 px-2 py-1 text-xs">Fit to screen</button>
                </div>

                <div className="space-y-1 text-sm">
                  <p><span className="font-semibold">Filename:</span> {previewResolved.fileName}</p>
                  <p><span className="font-semibold">Type:</span> {previewResolved.mimeType}</p>
                  <p><span className="font-semibold">Date:</span> {new Date(previewResolved.createdAt).toLocaleString()}</p>
                  <p><span className="font-semibold">Source:</span> {sourceBadge(previewResolved.source)}</p>
                  <p><span className="font-semibold">Status:</span> {previewResolved.generationStatus}</p>
                  <p><span className="font-semibold">Dimensions:</span> {previewResolved.width && previewResolved.height ? `${previewResolved.width} x ${previewResolved.height}` : "Unknown"}</p>
                  <p><span className="font-semibold">Duration:</span> {formatDuration(previewResolved.durationSeconds) || "-"}</p>
                  <p><span className="font-semibold">Size:</span> {formatFileSize(previewResolved.sizeBytes)}</p>
                  <p><span className="font-semibold">Folder:</span> {folders.find((folder) => folder.id === previewAsset.folderId)?.name || "Unfiled"}</p>
                  <p><span className="font-semibold">Campaigns:</span> {previewResolved.campaignIds.length ? previewResolved.campaignIds.join(", ") : "-"}</p>
                  <p><span className="font-semibold">Creator:</span> {previewResolved.creatorName || "-"}</p>
                  <p><span className="font-semibold">Usage rights:</span> {previewResolved.usageRightsStatus}</p>
                </div>

                {previewResolved.usageRightsStatus === "EXPIRED" ? (
                  <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">Usage rights expired.</p>
                ) : null}
                {previewResolved.usageRightsStatus === "EXPIRING" ? (
                  <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">Usage rights expire within 7 days.</p>
                ) : null}

                <div className="grid gap-2">
                  <button type="button" onClick={() => void downloadAsset(previewAsset.id)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Download</button>
                  {capabilities.canRename ? <button type="button" onClick={() => void renameAsset(previewAsset)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Rename</button> : null}
                  {capabilities.canEditTags ? <button type="button" onClick={() => void addTags(previewAsset)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Edit tags</button> : null}
                  {capabilities.canCreateWithAsset ? <Link href={`/studio?assetId=${previewAsset.id}`} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Create with this asset</Link> : null}
                  <button type="button" onClick={() => void copySecureLink(previewAsset.id)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Copy secure link</button>
                  <button type="button" onClick={() => void copyAssetId(previewAsset.id)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Copy asset ID</button>
                  {capabilities.canArchive && !previewAsset.archivedAt ? <button type="button" onClick={() => void archiveAsset(previewAsset)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Archive</button> : null}
                  {capabilities.canArchive && previewAsset.archivedAt ? <button type="button" onClick={() => void restoreAsset(previewAsset)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Restore</button> : null}
                  {capabilities.canDelete ? <button type="button" onClick={() => void remove(previewAsset)} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Delete</button> : null}
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
