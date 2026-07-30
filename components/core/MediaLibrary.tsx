"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadLocal,
  saveLocal,
  STORAGE_KEYS,
  type LibraryFolder,
  type MediaAsset,
} from "@/features/core/local-os";
import {
  createCloudFolder,
  loadCloudFolders,
  loadCloudMedia,
  moveCloudMediaToFolder,
  removeCloudMedia,
  renameCloudFolder,
  uploadCloudMedia,
} from "@/features/core/cloud-store";

function tagsFor(file: File): string[] {
  const tags = [file.type.split("/")[0] || "asset"];
  const name = file.name.toLowerCase();
  if (name.includes("logo")) tags.push("logo");
  if (name.includes("product")) tags.push("product");
  if (name.includes("social")) tags.push("social");
  return [...new Set(tags)];
}

export default function MediaLibrary() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState("ALL");
  const [newFolderName, setNewFolderName] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

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
      setMessage(`Folder “${folder.name}” created.`);
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
      setMessage(`Folder renamed to “${updated.name}”.`);
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

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setMessage("Uploading securely…");
    try {
      const added: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        added.push(
          await uploadCloudMedia(
            file,
            tagsFor(file),
            folderFilter !== "ALL" ? folderFilter : undefined,
          ),
        );
      }
      const next = [...added, ...assets];
      setAssets(next);
      saveLocal(STORAGE_KEYS.media, next);
      setMessage(`${added.length} asset${added.length === 1 ? "" : "s"} uploaded, organized, and tagged.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (asset: MediaAsset) => {
    setMessage("");
    try {
      await removeCloudMedia(asset);
      const next = assets.filter((item) => item.id !== asset.id);
      setAssets(next);
      saveLocal(STORAGE_KEYS.media, next);
      setMessage("Asset removed.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to remove asset.");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-dashed border-violet-300 bg-violet-50 p-6 text-center">
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

      <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5">
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
                onClick={() => setFolderFilter(folder.id)}
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
                  onClick={() => setFolderFilter(folder.id)}
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
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search names or tags"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-slate-200/60 bg-white/70 p-6 text-center text-slate-500">
            Upload your first brand asset to begin.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((asset) => (
              <article key={asset.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{asset.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{asset.type} · {(asset.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={() => void remove(asset)} className="text-xs text-rose-600 hover:text-rose-700">Remove</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {asset.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{tag}</span>)}
                </div>
                <label className="mt-4 block text-xs text-slate-500">
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
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
