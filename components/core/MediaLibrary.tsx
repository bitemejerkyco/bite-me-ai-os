"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import { SUCCESS_MESSAGES } from "@/features/help/success-messages";
import {
  loadLocal,
  saveLocal,
  STORAGE_KEYS,
  type LibraryFolder,
  type MediaAsset,
} from "@/features/core/local-os";
import type { TikTokConnectionView } from "@/features/integrations/tiktok/types";
import {
  createCloudFolder,
  loadCloudFolders,
  loadCloudMedia,
  moveCloudMediaToFolder,
  removeCloudMedia,
  renameCloudFolder,
  updateCloudMediaAsset,
  uploadCloudMedia,
} from "@/features/core/cloud-store";

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

const VIEW_MODE_KEY = "postmotive:media:view-mode";
const PAGE_SIZE = 24;

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

function mimeCategory(asset: MediaAsset, resolved?: ResolvedAsset): "image" | "video" | "file" {
  const mime = (resolved?.mimeType || asset.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
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

export default function MediaLibrary() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState("ALL");
  const [newFolderName, setNewFolderName] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tiktokView, setTikTokView] = useState<TikTokConnectionView | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => readViewMode());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolvedMap, setResolvedMap] = useState<Record<string, ResolvedAsset>>({});
  const [previewRequestNonce, setPreviewRequestNonce] = useState(0);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());

  const previewCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void Promise.all([loadCloudMedia(), loadCloudFolders("MEDIA")])
        .then(([cloud, savedFolders]) => {
          setAssets(cloud.length ? cloud : loadLocal(STORAGE_KEYS.media, []));
          setFolders(savedFolders);
        })
        .catch(() => setAssets(loadLocal(STORAGE_KEYS.media, [])));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    void fetch("/api/integrations/tiktok/status", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok?: boolean;
          data?: TikTokConnectionView;
        };
        if (response.ok && payload.ok && payload.data) {
          setTikTokView(payload.data);
        }
      })
      .catch(() => {
        // The library remains usable even if TikTok status cannot be loaded.
      });
  }, []);

  useEffect(() => {
    if (!previewAssetId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewAssetId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    previewCloseRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewAssetId]);

  const filtered = useMemo(
    () =>
      assets.filter((asset) => {
        const matchesSearch = `${asset.name} ${asset.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesFolder =
          folderFilter === "ALL"
            ? !asset.folderId
            : asset.folderId === folderFilter;
        return matchesSearch && matchesFolder;
      }),
    [assets, query, folderFilter],
  );

  const visibleAssets = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  useEffect(() => {
    const ids = visibleAssets.map((asset) => asset.id);
    if (!ids.length) return;

    void fetch("/api/media/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetIds: ids }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as ResolvePayload;
        if (!response.ok || !payload.ok || !payload.assets) {
          throw new Error("preview-resolve-failed");
        }
        const next: Record<string, ResolvedAsset> = {};
        for (const item of payload.assets) {
          next[item.assetId] = item;
        }
        setResolvedMap((current) => ({ ...current, ...next }));
      })
      .catch(() => {
        // Keep cards visible with placeholders when secure URL resolution fails.
      })
      .finally(() => {
        // Trigger a repaint signal when preview resolution attempt completes.
        setPreviewRequestNonce((value) => value + 1);
      });
  }, [visibleAssets]);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    setMessage("");
    try {
      const folder = await createCloudFolder("MEDIA", newFolderName);
      setFolders((current) =>
        [...current, folder].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setFolderFilter(folder.id);
      setNewFolderName("");
      setMessage(`Folder \"${folder.name}\" created.`);
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to create folder.",
      );
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
      setMessage(
        caught instanceof Error ? caught.message : "Unable to rename folder.",
      );
    }
  };

  const moveAsset = async (asset: MediaAsset, folderId: string) => {
    setMessage("");
    try {
      await moveCloudMediaToFolder(asset.id, folderId || undefined);
      const updated = { ...asset, folderId: folderId || undefined };
      const next = assets.map((item) =>
        item.id === asset.id ? updated : item,
      );
      setAssets(next);
      saveLocal(STORAGE_KEYS.media, next);
      setMessage(folderId ? "Asset moved." : "Asset moved to Unfiled.");
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to move asset.",
      );
    }
  };

  const renameAsset = async (asset: MediaAsset) => {
    const name = window.prompt("Rename asset", asset.name);
    if (!name || name.trim() === asset.name) return;
    try {
      await updateCloudMediaAsset(asset.id, { name: name.trim() });
      setAssets((current) =>
        current.map((item) =>
          item.id === asset.id ? { ...item, name: name.trim() } : item,
        ),
      );
      setMessage("Asset renamed.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to rename asset.");
    }
  };

  const addTags = async (asset: MediaAsset) => {
    const existing = asset.tags.join(", ");
    const value = window.prompt("Add tags (comma separated)", existing);
    if (value === null) return;
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    try {
      await updateCloudMediaAsset(asset.id, { tags });
      setAssets((current) =>
        current.map((item) => (item.id === asset.id ? { ...item, tags } : item)),
      );
      setMessage("Tags updated.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to update tags.");
    }
  };

  const archiveAsset = async (asset: MediaAsset) => {
    if (!window.confirm(`Archive ${asset.name}?`)) return;
    try {
      await updateCloudMediaAsset(asset.id, { archivedAt: new Date().toISOString() });
      const next = assets.filter((item) => item.id !== asset.id);
      setAssets(next);
      setMessage("Asset archived.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to archive asset.");
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setMessage("Uploading securely…");
    try {
      const added: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        const meta = await inferFileMetadata(file);
        added.push(
          await uploadCloudMedia(
            file,
            tagsFor(file),
            folderFilter !== "ALL" ? folderFilter : undefined,
            {
              source: "UPLOADED",
              generationStatus: "READY",
              width: meta.width,
              height: meta.height,
              durationSeconds: meta.durationSeconds,
            },
          ),
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
    if (!window.confirm(`Delete ${asset.name}? This cannot be undone.`)) return;
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

  const selectedCount = selectedIds.size;

  const toggleSelection = (assetId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const downloadAsset = (assetId: string) => {
    const resolved = resolvedMap[assetId];
    if (!resolved?.isDownloadAllowed) {
      setMessage("Download unavailable for this item.");
      return;
    }
    window.location.href = resolved.downloadUrl;
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

  const retryResolve = async (assetId: string) => {
    try {
      const response = await fetch("/api/media/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetIds: [assetId] }),
      });
      const payload = (await response.json()) as ResolvePayload;
      if (!response.ok || !payload.ok || !payload.assets?.length) {
        throw new Error("resolve-failed");
      }
      setResolvedMap((current) => ({ ...current, [assetId]: payload.assets![0] }));
      setBrokenIds((current) => {
        const next = new Set(current);
        next.delete(assetId);
        return next;
      });
      setMessage("Preview refreshed.");
    } catch {
      setMessage("Preview unavailable.");
    }
  };

  const changeViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VIEW_MODE_KEY, mode);
    }
  };

  const previewAsset = previewAssetId
    ? assets.find((item) => item.id === previewAssetId) || null
    : null;
  const previewResolved = previewAsset ? resolvedMap[previewAsset.id] : undefined;

  const canLoadMore = filtered.length > visibleCount;

  return (
    <div className="space-y-5">
      <section data-help="media-upload-zone" className="rounded-3xl border border-dashed border-violet-300 bg-violet-50 p-6 text-center">
        <h2 className="text-xl font-bold">Upload branded media</h2>
        <p className="mt-2 text-sm text-slate-500">Photos, videos, logos, graphics, and licensed audio.</p>
        <label className={`mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 font-semibold hover:bg-violet-500 ${uploading ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
          {uploading ? "Uploading…" : "Choose files"}
          <input
            type="file"
            multiple
            disabled={uploading}
            accept="image/*,video/*,audio/*,.pdf"
            onChange={(event) => void upload(event.target.files)}
            className="hidden"
          />
        </label>
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {assets.length ? (
          <Link
            href="/studio"
            className="mt-4 inline-block rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
          >
            Create content with these assets →
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
            {[
              {
                id: "ALL",
                name: "All assets",
                count: assets.filter((asset) => !asset.folderId).length,
              },
            ].map((folder) => (
              <button
                key={folder.id}
                onClick={() => {
                  setFolderFilter(folder.id);
                  setVisibleCount(PAGE_SIZE);
                  setSelectedIds(new Set());
                }}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  folderFilter === folder.id
                    ? "border-violet-300 bg-violet-100 font-semibold text-violet-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {folder.name} ({folder.count})
              </button>
            ))}
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
                  ▰ {folder.name} (
                  {assets.filter((asset) => asset.folderId === folder.id).length})
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
            <h2 className="text-xl font-bold">Asset library</h2>
            <p className="text-sm text-slate-500">{assets.length} saved assets</p>
          </div>
          <div className="flex items-center gap-2">
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
                setSelectedIds(new Set());
              }}
              placeholder="Search names or tags"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            />
          </div>
        </div>

        {selectedCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="font-semibold">{selectedCount} selected</span>
            <button
              type="button"
              onClick={() => {
                if (selectedCount === 1) {
                  const only = [...selectedIds][0];
                  downloadAsset(only);
                  return;
                }
                setMessage("Bulk ZIP download is not supported yet. Download items individually.");
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5"
            >
              Download
            </button>
            {selectedCount > 1 ? (
              <span className="text-xs text-slate-500">ZIP download coming soon</span>
            ) : null}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5"
            >
              Clear selection
            </button>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <div className="mt-6"><GuidedEmptyState title="Your Media Library is empty" description="Upload your logo, product photos, videos, and brand assets so PostMotive can create more accurate branded content." estimatedTime="2-4 minutes" primaryAction={{ label: "Upload Media", href: "/media" }} secondaryAction={{ label: "Create Folder", href: "/media" }} /></div>
        ) : viewMode === "grid" ? (
          <div data-help="media-asset-grid" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleAssets.map((asset) => {
              const resolved = resolvedMap[asset.id];
              const category = mimeCategory(asset, resolved);
              const previewUnavailable = Boolean(resolved?.error) || brokenIds.has(asset.id);
              const thumbUrl = resolved?.thumbnailUrl || "";
              const duration = formatDuration(resolved?.durationSeconds ?? asset.durationSeconds);

              return (
                <article key={asset.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70">
                  <div className="relative">
                    <input
                      aria-label={`Select ${asset.name}`}
                      type="checkbox"
                      checked={selectedIds.has(asset.id)}
                      onChange={() => toggleSelection(asset.id)}
                      className="absolute left-3 top-3 z-10 h-4 w-4 rounded border-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => openPreview(asset.id)}
                      className="group relative block h-48 w-full overflow-hidden bg-slate-100 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      {category === "image" && thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={asset.name || "Media image"}
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={() =>
                            setBrokenIds((current) => new Set(current).add(asset.id))
                          }
                        />
                      ) : null}

                      {category === "video" && thumbUrl ? (
                        <>
                          <img
                            src={thumbUrl}
                            alt={asset.name || "Video preview"}
                            loading="lazy"
                            className="h-full w-full object-cover"
                            onError={() =>
                              setBrokenIds((current) => new Set(current).add(asset.id))
                            }
                          />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 text-white">▶</span>
                          {duration ? (
                            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">{duration}</span>
                          ) : null}
                        </>
                      ) : null}

                      {((category === "file") || previewUnavailable || !thumbUrl) ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold tracking-wide shadow-sm">{extensionFor(asset.name)}</span>
                          <span className="text-xs font-medium">{previewUnavailable ? "Preview unavailable" : "Preview"}</span>
                          {category === "video" ? <span className="text-xs">Video</span> : null}
                        </div>
                      ) : null}
                    </button>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{asset.name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {resolved?.mimeType || asset.type} · {formatFileSize(resolved?.sizeBytes || asset.size)}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase text-slate-600">{resolved?.label || "uploaded"}</span>
                    </div>

                    {resolved?.usageRightsStatus === "EXPIRED" ? (
                      <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">Usage rights expired</p>
                    ) : null}
                    {resolved?.usageRightsStatus === "EXPIRING" ? (
                      <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">Usage rights expiring soon</p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {asset.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{tag}</span>)}
                    </div>

                    {previewUnavailable ? (
                      <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                        <p>Preview unavailable</p>
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => void retryResolve(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">Retry</button>
                          {resolved?.isDownloadAllowed ? (
                            <button type="button" onClick={() => downloadAsset(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">Download original</button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500">
                        Folder
                        <select
                          value={asset.folderId || ""}
                          onChange={(event) =>
                            void moveAsset(asset, event.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                          <option value="">Unfiled</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <button type="button" onClick={() => openPreview(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">View</button>
                        <button type="button" onClick={() => downloadAsset(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">Download</button>
                        <button type="button" onClick={() => void renameAsset(asset)} className="rounded border border-slate-200 bg-white px-2 py-1">Rename</button>
                        <button type="button" onClick={() => void addTags(asset)} className="rounded border border-slate-200 bg-white px-2 py-1">Add tags</button>
                        <button type="button" onClick={() => void copySecureLink(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1">Copy secure link</button>
                        <button type="button" onClick={() => void archiveAsset(asset)} className="rounded border border-slate-200 bg-white px-2 py-1">Archive</button>
                        <button type="button" onClick={() => void remove(asset)} className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">Delete</button>
                      </div>
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
                  <th className="px-3 py-2">Dimensions / Duration</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Folder</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleAssets.map((asset) => {
                  const resolved = resolvedMap[asset.id];
                  const thumb = resolved?.thumbnailUrl || "";
                  const duration = formatDuration(resolved?.durationSeconds ?? asset.durationSeconds);
                  const dimensions = resolved?.width && resolved?.height ? `${resolved.width}x${resolved.height}` : "-";
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
                      <td className="px-3 py-2">{duration || dimensions}</td>
                      <td className="px-3 py-2">{new Date(asset.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">{folders.find((folder) => folder.id === asset.folderId)?.name || "Unfiled"}</td>
                      <td className="px-3 py-2">{resolved?.label || "uploaded"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => openPreview(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">View</button>
                          <button type="button" onClick={() => downloadAsset(asset.id)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">Download</button>
                          <button type="button" onClick={() => void remove(asset)} className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">Delete</button>
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

        {!Object.keys(resolvedMap).length && previewRequestNonce === 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : null}
      </section>

      {previewAsset && previewResolved ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60 p-0 md:items-center md:justify-center md:p-6" role="dialog" aria-modal="true" aria-label="Media preview dialog">
          <div className="flex h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white md:h-[85vh] md:max-w-6xl md:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="truncate text-base font-semibold">{previewAsset.name}</h3>
              <button ref={previewCloseRef} type="button" onClick={() => setPreviewAssetId(null)} className="rounded border border-slate-200 px-3 py-1 text-sm">Close</button>
            </div>
            <div className="grid h-full min-h-0 lg:grid-cols-[1fr_320px]">
              <div className="relative flex min-h-0 items-center justify-center overflow-auto bg-slate-900 p-3">
                {mimeCategory(previewAsset, previewResolved) === "image" && previewResolved.previewUrl ? (
                  <img
                    src={previewResolved.previewUrl}
                    alt={previewAsset.name || "Media preview"}
                    className="max-h-full max-w-full"
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
                {mimeCategory(previewAsset, previewResolved) === "file" ? (
                  <div className="text-center text-white">
                    <p className="text-sm">Preview unavailable for this file type.</p>
                  </div>
                ) : null}
              </div>

              <aside className="min-h-0 space-y-3 overflow-y-auto border-t border-slate-200 p-4 lg:border-l lg:border-t-0">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} className="rounded border border-slate-200 px-2 py-1 text-xs">Zoom -</button>
                  <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} className="rounded border border-slate-200 px-2 py-1 text-xs">Zoom +</button>
                  <button type="button" onClick={() => setZoom(1)} className="rounded border border-slate-200 px-2 py-1 text-xs">Fit</button>
                  <button type="button" onClick={() => setZoom(1)} className="rounded border border-slate-200 px-2 py-1 text-xs">Original</button>
                </div>

                <div className="space-y-1 text-sm">
                  <p><span className="font-semibold">Filename:</span> {previewResolved.fileName}</p>
                  <p><span className="font-semibold">Type:</span> {previewResolved.mimeType}</p>
                  <p><span className="font-semibold">Date:</span> {new Date(previewResolved.createdAt).toLocaleString()}</p>
                  <p><span className="font-semibold">Source:</span> {previewResolved.source}</p>
                  <p><span className="font-semibold">Dimensions:</span> {previewResolved.width && previewResolved.height ? `${previewResolved.width} x ${previewResolved.height}` : "Unknown"}</p>
                  <p><span className="font-semibold">Duration:</span> {formatDuration(previewResolved.durationSeconds) || "-"}</p>
                  <p><span className="font-semibold">Size:</span> {formatFileSize(previewResolved.sizeBytes)}</p>
                  <p><span className="font-semibold">Folder:</span> {folders.find((folder) => folder.id === previewAsset.folderId)?.name || "Unfiled"}</p>
                  <p><span className="font-semibold">Campaigns:</span> {previewResolved.campaignIds.length ? previewResolved.campaignIds.join(", ") : "-"}</p>
                  <p><span className="font-semibold">Creator:</span> {previewResolved.creatorName || "-"}</p>
                  <p><span className="font-semibold">Usage rights:</span> {previewResolved.usageRightsStatus}</p>
                  <p><span className="font-semibold">Label:</span> {previewResolved.label}</p>
                </div>

                {previewResolved.usageRightsStatus === "EXPIRED" ? (
                  <p className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">Usage rights expired.</p>
                ) : null}
                {previewResolved.usageRightsStatus === "EXPIRING" ? (
                  <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">Usage rights expire within 7 days.</p>
                ) : null}

                <div className="grid gap-2">
                  <button type="button" onClick={() => openPreview(previewAsset.id)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">View</button>
                  <button type="button" onClick={() => downloadAsset(previewAsset.id)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Download</button>
                  <button type="button" onClick={() => void renameAsset(previewAsset)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Rename</button>
                  <button type="button" onClick={() => void moveAsset(previewAsset, "")} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Move to Folder</button>
                  <button type="button" onClick={() => void addTags(previewAsset)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Add Tags</button>
                  <button type="button" disabled className="cursor-not-allowed rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">Add to Campaign</button>
                  <button type="button" disabled className="cursor-not-allowed rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">Add to Content</button>
                  <button type="button" onClick={() => void copySecureLink(previewAsset.id)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Copy Secure Link</button>
                  <button type="button" onClick={() => void archiveAsset(previewAsset)} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm">Archive</button>
                  <button type="button" onClick={() => void remove(previewAsset)} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Delete</button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
