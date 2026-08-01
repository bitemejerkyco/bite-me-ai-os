"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import { SUCCESS_MESSAGES } from "@/features/help/success-messages";
import {
  createCloudFolder,
  loadCloudDrafts,
  loadCloudFolders,
  moveCloudDraftToFolder,
  renameCloudFolder,
  resolveCloudMediaUrl,
  saveCloudDraft,
} from "@/features/core/cloud-store";
import {
  loadLocal,
  saveLocal,
  STORAGE_KEYS,
  type ContentDraft,
  type LibraryFolder,
} from "@/features/core/local-os";

export default function ContentLibrary() {
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState("ALL");
  const [newFolderName, setNewFolderName] = useState("");
  const [filter, setFilter] =
    useState<"ALL" | ContentDraft["status"]>("ALL");
  const [selected, setSelected] = useState<ContentDraft | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const requested = new URLSearchParams(window.location.search).get(
        "status",
      );
      if (requested === "DRAFT" || requested === "APPROVED") {
        setFilter(requested);
      } else if (requested?.toLowerCase() === "awaiting-approval") {
        setFilter("DRAFT");
      }
      void Promise.all([loadCloudDrafts(), loadCloudFolders("CONTENT")])
        .then(([items, savedFolders]) => {
          setDrafts(items);
          setFolders(savedFolders);
          const first =
            items.find((item) => item.status === requested) || items[0] || null;
          setSelected(first);
        })
        .catch((caught: unknown) =>
          setMessage(
            caught instanceof Error
              ? caught.message
              : "Unable to load content.",
          ),
        );
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!selected?.mediaStoragePath) {
        setMediaUrl("");
        return;
      }
      void resolveCloudMediaUrl(selected.mediaStoragePath)
        .then(setMediaUrl)
        .catch(() => setMediaUrl(""));
    });
    return () => cancelAnimationFrame(frame);
  }, [selected?.mediaStoragePath]);

  const visible = useMemo(
    () => {
      const statusMatches =
        filter === "ALL"
        ? drafts
        : drafts.filter((draft) => draft.status === filter);
      if (folderFilter === "ALL") return statusMatches;
      if (folderFilter === "UNFILED") {
        return statusMatches.filter((draft) => !draft.folderId);
      }
      return statusMatches.filter((draft) => draft.folderId === folderFilter);
    },
    [drafts, filter, folderFilter],
  );

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    setWorking(true);
    setMessage("");
    try {
      const folder = await createCloudFolder("CONTENT", newFolderName);
      setFolders((current) =>
        [...current, folder].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setFolderFilter(folder.id);
      setNewFolderName("");
      setMessage(`Folder “${folder.name}” created. Recommended next step: move related drafts into this folder.`);
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to create folder.",
      );
    } finally {
      setWorking(false);
    }
  };

  const renameFolder = async (folder: LibraryFolder) => {
    const name = window.prompt("Rename folder", folder.name);
    if (!name || name.trim() === folder.name) return;
    setWorking(true);
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
    } finally {
      setWorking(false);
    }
  };

  const moveSelected = async (folderId: string) => {
    if (!selected) return;
    setWorking(true);
    setMessage("");
    try {
      const next = { ...selected, folderId: folderId || undefined };
      await moveCloudDraftToFolder(selected.id, next.folderId);
      setDrafts((current) =>
        current.map((draft) => (draft.id === next.id ? next : draft)),
      );
      setSelected(next);
      setMessage(
        folderId
          ? `Moved to ${folders.find((folder) => folder.id === folderId)?.name || "folder"}.`
          : "Moved to Unfiled.",
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to move content.",
      );
    } finally {
      setWorking(false);
    }
  };

  const persist = async (
    draft: ContentDraft,
    successMessage: string,
  ): Promise<void> => {
    setWorking(true);
    setMessage("");
    try {
      await saveCloudDraft(draft);
      setDrafts((current) =>
        current.map((item) => (item.id === draft.id ? draft : item)),
      );
      setSelected(draft);
      const localDrafts = loadLocal<ContentDraft[]>(STORAGE_KEYS.drafts, []);
      saveLocal(
        STORAGE_KEYS.drafts,
        localDrafts.some((item) => item.id === draft.id)
          ? localDrafts.map((item) => (item.id === draft.id ? draft : item))
          : [draft, ...localDrafts],
      );
      setMessage(successMessage);
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to save content.",
      );
      throw caught;
    } finally {
      setWorking(false);
    }
  };

  const saveChanges = async () => {
    if (!selected) return;
    if (!selected.title.trim() || !selected.copy.trim()) {
      setMessage("Add a title and content before saving.");
      return;
    }
    await persist(
      {
        ...selected,
        title: selected.title.trim(),
        copy: selected.copy.trim(),
      },
      `${SUCCESS_MESSAGES.contentSaved().title} ${SUCCESS_MESSAGES.contentSaved().detail}`,
    ).catch(() => undefined);
  };

  const openCalendar = async () => {
    if (!selected) return;
    if (!selected.title.trim() || !selected.copy.trim()) {
      setMessage("Add a title and content before scheduling.");
      return;
    }
    const prepared = {
      ...selected,
      title: selected.title.trim(),
      copy: selected.copy.trim(),
      status: "APPROVED" as const,
    };
    try {
      await persist(prepared, `${SUCCESS_MESSAGES.contentApproved().title} ${SUCCESS_MESSAGES.contentApproved().detail}`);
      saveLocal(STORAGE_KEYS.calendarPrefill, prepared);
      window.location.assign("/calendar");
    } catch {
      // persist displays the actionable error.
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <section data-help="content-folders" className="rounded-3xl border border-slate-200/80 bg-white/80 p-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">Folders</h2>
            <span className="text-xs text-slate-500">{folders.length}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createFolder();
              }}
              placeholder="New folder name"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <button
              disabled={working || !newFolderName.trim()}
              onClick={() => void createFolder()}
              className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <div className="mt-3 space-y-1">
            {[
              { id: "ALL", name: "All content", count: drafts.length },
              {
                id: "UNFILED",
                name: "Unfiled",
                count: drafts.filter((draft) => !draft.folderId).length,
              },
            ].map((folder) => (
              <button
                key={folder.id}
                onClick={() => setFolderFilter(folder.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                  folderFilter === folder.id
                    ? "bg-violet-100 font-semibold text-violet-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>▤ {folder.name}</span>
                <span>{folder.count}</span>
              </button>
            ))}
            {folders.map((folder) => (
              <div key={folder.id} className="flex items-center gap-1">
                <button
                  onClick={() => setFolderFilter(folder.id)}
                  className={`flex min-w-0 flex-1 items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                    folderFilter === folder.id
                      ? "bg-violet-100 font-semibold text-violet-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">▰ {folder.name}</span>
                  <span>
                    {drafts.filter((draft) => draft.folderId === folder.id).length}
                  </span>
                </button>
                <button
                  onClick={() => void renameFolder(folder)}
                  className="rounded-lg px-2 py-2 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={`Rename ${folder.name}`}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="my-5 border-t border-slate-200/70" />
        <div className="flex flex-wrap gap-2">
          {(["ALL", "DRAFT", "APPROVED"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-xl px-3 py-2 text-sm ${
                filter === status
                  ? "bg-violet-600 text-white"
                  : "border border-slate-200/80 text-slate-700"
              }`}
            >
              {status === "ALL"
                ? `All (${drafts.length})`
                : `${status === "DRAFT" ? "Drafts" : "Approved"} (${
                    drafts.filter((draft) => draft.status === status).length
                  })`}
            </button>
          ))}
        </div>
        <div data-help="content-draft-list" className="mt-5 space-y-3">
          {visible.length ? (
            visible.map((draft) => (
              <button
                key={draft.id}
                onClick={() => setSelected(draft)}
                className={`block w-full rounded-2xl border p-4 text-left ${
                  selected?.id === draft.id
                    ? "border-rose-300 bg-violet-50"
                    : "border-slate-200/80 bg-white/70 hover:border-white/25"
                }`}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                    {draft.entryType === "AD" ? "AD" : "POST"}
                  </span>
                  {draft.contentFormat === "VERTICAL_VIDEO" ? (
                    <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-700">
                      VIDEO
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                    {draft.status}
                  </span>
                </div>
                <p className="mt-3 font-semibold">{draft.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {draft.channel} ·{" "}
                  {new Date(draft.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))
          ) : (
            <GuidedEmptyState title="No content yet." description="Generate or create content first, then review and approve it here before scheduling." estimatedTime="3 minutes" primaryAction={{ label: "Generate Content", href: "/studio" }} secondaryAction={{ label: "Learn the content flow", href: "/help" }} />
          )}
        </div>
        {message ? <p className="mt-4 text-sm text-rose-700">{message}</p> : null}
      </section>

      <section data-help="content-editor" className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 md:p-7">
        {!selected ? (
          <GuidedEmptyState title="No draft selected." description="Choose a draft from the library to review copy, organize it, and prepare it for approval or scheduling." primaryAction={{ label: "Open AI Studio", href: "/studio" }} secondaryAction={{ label: "Open Help Center", href: "/help" }} />
        ) : (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">
                  {selected.channel} · {selected.status}
                </p>
                <h2 className="mt-1 text-2xl font-bold">{selected.title}</h2>
              </div>
              <Link
                href="/studio"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                Create another
              </Link>
            </div>
            <label className="mt-5 block text-sm text-slate-700">
              Folder
              <select
                value={selected.folderId || ""}
                disabled={working}
                onChange={(event) => void moveSelected(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                <option value="">Unfiled</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
            {mediaUrl ? (
              <video
                src={mediaUrl}
                controls
                playsInline
                className="mx-auto mt-5 max-h-[560px] rounded-2xl bg-black"
              />
            ) : null}
            <label className="mt-5 block text-sm text-slate-700">
              Title
              <input
                value={selected.title}
                onChange={(event) =>
                  setSelected({ ...selected, title: event.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold"
              />
            </label>
            <label className="mt-4 block text-sm text-slate-700">
              Post or ad content
              <textarea
                value={selected.copy}
                onChange={(event) =>
                  setSelected({ ...selected, copy: event.target.value })
                }
                className="mt-1 min-h-52 w-full rounded-2xl border border-slate-200 bg-white p-4 leading-7"
              />
            </label>
            <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-800">
              {selected.complianceNote}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                data-help="content-schedule"
                disabled={working}
                onClick={() => void openCalendar()}
                className="rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
              >
                {working
                  ? "Saving…"
                  : selected.status === "APPROVED"
                    ? "Save & continue to publishing →"
                    : "Approve & continue to publishing →"}
              </button>
              <button
                disabled={working}
                onClick={() => void saveChanges()}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-violet-50 disabled:opacity-60"
              >
                Save changes only
              </button>
            </div>
            {selected.entryType === "AD" ? (
              <p className="mt-3 text-xs text-amber-800">
                Paid ads will enter the approval queue before any launch or
                spending.
              </p>
            ) : null}
            {message ? (
              <p className="mt-4 text-sm text-slate-700">{message}</p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
