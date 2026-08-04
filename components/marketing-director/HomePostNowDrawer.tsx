"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { SafeTikTokPublishJob } from "@/features/integrations/tiktok/publish-jobs";

type EligibleItem = {
  id: string;
  videoProjectId: string;
  mediaAssetId: string | null;
  title: string;
  channel: string;
  caption: string;
  version: string;
  status: "APPROVED";
  thumbnailStoragePath: string | null;
  mediaStoragePath: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function HomePostNowDrawer({ open, onClose }: Props) {
  const [items, setItems] = useState<EligibleItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [jobByProjectId, setJobByProjectId] = useState<Record<string, SafeTikTokPublishJob>>({});

  const activeStatuses = useMemo(
    () => new Set(["draft", "validating", "initializing", "uploading", "processing", "reconnect_required"]),
    [],
  );

  async function loadEligible() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/publishing/post-now/eligible", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: EligibleItem[];
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to load post now items.");
      }
      setItems(payload.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setItems([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      void loadEligible();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || items.length === 0) return;
    let cancelled = false;
    async function hydrateThumbnails() {
      const supabase = createClient();
      const next: Record<string, string> = {};
      for (const item of items) {
        if (!item.thumbnailStoragePath) continue;
        const { data } = await supabase.storage
          .from("brand-media")
          .createSignedUrl(item.thumbnailStoragePath, 60 * 5);
        if (data?.signedUrl) {
          next[item.id] = data.signedUrl;
        }
      }
      if (!cancelled) setThumbnails(next);
    }
    void hydrateThumbnails();
    return () => {
      cancelled = true;
    };
  }, [open, items]);

  const hasItems = useMemo(() => items.length > 0, [items.length]);

  async function postNow(item: EligibleItem) {
    if (!item.mediaAssetId) {
      setMessage("This approved video is missing a linked media asset. Open it in AI Studio and regenerate, then retry.");
      return;
    }

    type PreflightPayload = {
      ok?: boolean;
      data?: {
        directPostAllowed: boolean;
        uploadDraftAllowed: boolean;
        requiresPrivateOnly: boolean;
        modeMessage: string;
        creator?: { privacyOptions?: string[] | null };
        blockers?: Array<{ code?: string; message?: string; action?: string }>;
      };
      error?: string;
    };

    let mode: "DIRECT_POST" | "UPLOAD_DRAFT" = "UPLOAD_DRAFT";
    let privacyLevel = "";

    try {
      const preflightResponse = await fetch(
        `/api/publishing/post-now/preflight?mediaAssetId=${encodeURIComponent(item.mediaAssetId)}`,
        { cache: "no-store" },
      );
      const preflightPayload = (await preflightResponse.json()) as PreflightPayload;
      if (!preflightResponse.ok || !preflightPayload.ok || !preflightPayload.data) {
        throw new Error(preflightPayload.error || "Unable to validate TikTok publishing requirements.");
      }

      if (!preflightPayload.data.directPostAllowed && !preflightPayload.data.uploadDraftAllowed) {
        const firstBlocker = preflightPayload.data.blockers?.[0];
        throw new Error(
          firstBlocker
            ? `${firstBlocker.message || "Publishing is blocked."} ${firstBlocker.action || "Reconnect TikTok and review publishing settings."}`
            : "Publishing is blocked. Reconnect TikTok and review publishing settings.",
        );
      }

      mode = preflightPayload.data.directPostAllowed ? "DIRECT_POST" : "UPLOAD_DRAFT";
      if (mode === "DIRECT_POST") {
        const options = preflightPayload.data.creator?.privacyOptions || [];
        const defaultOption = options[0] || "SELF_ONLY";
        const selected = window.prompt(
          `Select TikTok privacy (${options.join(", ") || "SELF_ONLY"}).${preflightPayload.data.requiresPrivateOnly ? " TikTok currently allows private-only posting for this account." : ""}`,
          defaultOption,
        );
        if (!selected) {
          setMessage("Posting canceled. Privacy level selection is required.");
          return;
        }
        privacyLevel = selected.trim();
        if (!privacyLevel || (options.length > 0 && !options.includes(privacyLevel))) {
          setMessage("Posting canceled. Choose one of the privacy levels returned by TikTok.");
          return;
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return;
    }

    const idempotencyKey = `${item.videoProjectId}:${new Date().toISOString().slice(0, 16)}`;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/publishing/post-now/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          videoProjectId: item.videoProjectId,
          channel: item.channel,
          idempotencyKey,
          mode,
          privacyLevel,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        duplicate?: boolean;
        setupRedirect?: string;
        data?: { jobId?: string; publishId?: string; status?: string; mode?: string };
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        if (payload.setupRedirect) {
          window.location.assign(payload.setupRedirect);
          return;
        }
        throw new Error(payload.error || "Unable to post now.");
      }
      setMessage(
        payload.duplicate
          ? "This item was already queued or published. Duplicate posting was prevented."
          : "TikTok publish request submitted. Live status is shown below.",
      );
      const jobId = String(payload.data?.jobId || "").trim();
      if (jobId) {
        const jobResponse = await fetch(`/api/integrations/tiktok/jobs/${jobId}`, {
          cache: "no-store",
        });
        const jobPayload = (await jobResponse.json()) as {
          ok?: boolean;
          data?: SafeTikTokPublishJob;
        };
        if (jobResponse.ok && jobPayload.ok && jobPayload.data) {
          setJobByProjectId((current) => ({
            ...current,
            [item.videoProjectId]: jobPayload.data as SafeTikTokPublishJob,
          }));
        }
      }
      await loadEligible();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const activeJobs = Object.values(jobByProjectId).filter((job) => activeStatuses.has(job.status));
    if (!activeJobs.length) return;
    let disposed = false;

    async function poll() {
      await Promise.all(
        activeJobs.map(async (job) => {
          try {
            const response = await fetch(`/api/integrations/tiktok/jobs/${job.id}`, {
              cache: "no-store",
            });
            const payload = (await response.json()) as {
              ok?: boolean;
              data?: SafeTikTokPublishJob;
            };
            if (!disposed && response.ok && payload.ok && payload.data) {
              const next = payload.data;
              setJobByProjectId((current) => {
                const key = Object.keys(current).find((projectId) => current[projectId]?.id === next.id);
                if (!key) return current;
                return { ...current, [key]: next };
              });
            }
          } catch {
            // Polling is best-effort.
          }
        }),
      );
    }

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 7000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeStatuses, jobByProjectId, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95]">
      <button type="button" className="absolute inset-0 bg-slate-950/45" onClick={onClose} aria-label="Close post now drawer" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[640px] overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-900">Post now</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Showing completed, approved, unpublished AI Studio content.
        </p>
        {message ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</p>
        ) : null}

        {busy && !hasItems ? <p className="mt-5 text-sm text-slate-600">Loading eligible content…</p> : null}
        {!busy && !hasItems ? (
          <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Nothing is currently eligible. Approve a completed AI Studio video first.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex gap-3">
                <div className="h-24 w-16 overflow-hidden rounded-lg bg-slate-100">
                  {thumbnails[item.id] ? (
                    <img src={thumbnails[item.id]} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[10px] text-slate-500">No thumb</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.channel} · {item.version} · {item.status}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-600">{item.caption}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void postNow(item)}
                      disabled={busy}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Post now
                    </button>
                    <Link
                      href={`/calendar?videoProjectId=${encodeURIComponent(item.videoProjectId)}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Schedule
                    </Link>
                    <Link
                      href={`/studio?projectId=${encodeURIComponent(item.videoProjectId)}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Open in AI Studio
                    </Link>
                  </div>
                  {jobByProjectId[item.videoProjectId] ? (
                    <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                      TikTok: {jobByProjectId[item.videoProjectId]!.status.replaceAll("_", " ")}
                      {jobByProjectId[item.videoProjectId]!.publishId
                        ? ` · publish id ${jobByProjectId[item.videoProjectId]!.publishId}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
