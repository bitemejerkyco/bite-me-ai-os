"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadCloudDrafts,
  resolveCloudMediaUrl,
  saveCloudDraft,
} from "@/features/core/cloud-store";
import {
  loadLocal,
  saveLocal,
  STORAGE_KEYS,
  type ContentDraft,
} from "@/features/core/local-os";

export default function ContentLibrary() {
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
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
      }
      void loadCloudDrafts()
        .then((items) => {
          setDrafts(items);
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
    () =>
      filter === "ALL"
        ? drafts
        : drafts.filter((draft) => draft.status === filter),
    [drafts, filter],
  );

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
      "Changes saved.",
    ).catch(() => undefined);
  };

  const approve = async () => {
    if (!selected) return;
    await persist(
      { ...selected, status: "APPROVED" },
      "Draft approved and ready to schedule.",
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
    };
    try {
      await persist(prepared, "Content saved.");
      saveLocal(STORAGE_KEYS.calendarPrefill, prepared);
      window.location.assign("/calendar");
    } catch {
      // persist displays the actionable error.
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5">
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
        <div className="mt-5 space-y-3">
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
            <p className="text-sm text-slate-500">
              No content matches this filter.
            </p>
          )}
        </div>
        {message ? <p className="mt-4 text-sm text-rose-700">{message}</p> : null}
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 md:p-7">
        {!selected ? (
          <p className="text-slate-500">Select a content record to preview it.</p>
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
                disabled={working}
                onClick={() => void saveChanges()}
                className="rounded-xl border border-emerald-500/40 px-4 py-2 text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-60"
              >
                {working ? "Saving…" : "Save changes"}
              </button>
              {selected.status !== "APPROVED" ? (
                <button
                  disabled={working}
                  onClick={() => void approve()}
                  className="rounded-xl border border-blue-500/40 px-4 py-2 text-blue-700 hover:bg-blue-500/10 disabled:opacity-60"
                >
                  Approve draft
                </button>
              ) : (
                <span className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-blue-700">
                  Approved ✓
                </span>
              )}
              <button
                disabled={working}
                onClick={() => void openCalendar()}
                className="rounded-xl bg-violet-600 px-4 py-2 font-semibold hover:bg-violet-500 disabled:opacity-60"
              >
                Schedule / Post now
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
