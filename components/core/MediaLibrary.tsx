"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadLocal, saveLocal, STORAGE_KEYS, type MediaAsset } from "@/features/core/local-os";
import {
  loadCloudMedia,
  removeCloudMedia,
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
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadCloudMedia()
        .then((cloud) =>
          setAssets(cloud.length ? cloud : loadLocal(STORAGE_KEYS.media, [])),
        )
        .catch(() => setAssets(loadLocal(STORAGE_KEYS.media, [])));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const filtered = useMemo(
    () =>
      assets.filter((asset) =>
        `${asset.name} ${asset.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [assets, query],
  );

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setMessage("Uploading securely…");
    try {
      const added: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        added.push(await uploadCloudMedia(file, tagsFor(file)));
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
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
