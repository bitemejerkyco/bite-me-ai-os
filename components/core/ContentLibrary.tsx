"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadCloudDrafts,
  resolveCloudMediaUrl,
} from "@/features/core/cloud-store";
import type { ContentDraft } from "@/features/core/local-os";

export default function ContentLibrary() {
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [filter, setFilter] =
    useState<"ALL" | ContentDraft["status"]>("ALL");
  const [selected, setSelected] = useState<ContentDraft | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [message, setMessage] = useState("");

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

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "DRAFT", "APPROVED"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-lg px-3 py-2 text-sm ${
                filter === status
                  ? "bg-red-600 text-white"
                  : "border border-white/10 text-zinc-300"
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
                className={`block w-full rounded-xl border p-4 text-left ${
                  selected?.id === draft.id
                    ? "border-red-500/60 bg-red-500/5"
                    : "border-white/10 bg-black/20 hover:border-white/25"
                }`}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs">
                    {draft.entryType === "AD" ? "AD" : "POST"}
                  </span>
                  {draft.contentFormat === "VERTICAL_VIDEO" ? (
                    <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs text-purple-200">
                      VIDEO
                    </span>
                  ) : null}
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs">
                    {draft.status}
                  </span>
                </div>
                <p className="mt-3 font-semibold">{draft.title}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {draft.channel} ·{" "}
                  {new Date(draft.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))
          ) : (
            <p className="text-sm text-zinc-400">
              No content matches this filter.
            </p>
          )}
        </div>
        {message ? <p className="mt-4 text-sm text-red-200">{message}</p> : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111827] p-5 md:p-7">
        {!selected ? (
          <p className="text-zinc-400">Select a content record to preview it.</p>
        ) : (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-400">
                  {selected.channel} · {selected.status}
                </p>
                <h2 className="mt-1 text-2xl font-bold">{selected.title}</h2>
              </div>
              <Link
                href="/calendar"
                className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-200"
              >
                Open Calendar
              </Link>
            </div>
            {mediaUrl ? (
              <video
                src={mediaUrl}
                controls
                playsInline
                className="mx-auto mt-5 max-h-[560px] rounded-xl bg-black"
              />
            ) : null}
            <div className="mt-5 whitespace-pre-wrap rounded-xl border border-white/10 bg-zinc-950 p-4 leading-7">
              {selected.copy}
            </div>
            <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">
              {selected.complianceNote}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

