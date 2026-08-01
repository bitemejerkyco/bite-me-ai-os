"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadCloudMedia } from "@/features/core/cloud-store";
import type { MediaAsset } from "@/features/core/local-os";
import type { SafeTikTokPublishJob } from "@/features/integrations/tiktok/publish-jobs";
import type { TikTokConnectionView } from "@/features/integrations/tiktok/types";

type TikTokPublishPanelProps = {
  view: TikTokConnectionView | null;
  betaAllowed: boolean;
  betaMessage: string | null;
  initialJobs: SafeTikTokPublishJob[];
  initialSelectedAssetId?: string | null;
};

const ACTIVE_STATUSES = new Set([
  "draft",
  "validating",
  "initializing",
  "uploading",
  "processing",
  "reconnect_required",
]);

function statusLabel(status: SafeTikTokPublishJob["status"]): string {
  return status.replaceAll("_", " ");
}

export default function TikTokPublishPanel({
  view,
  betaAllowed,
  betaMessage,
  initialJobs,
  initialSelectedAssetId,
}: TikTokPublishPanelProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedAssetId, setSelectedAssetId] = useState(initialSelectedAssetId || "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    void loadCloudMedia().then((items) => {
      if (!disposed) {
        setAssets(items.filter((asset) => asset.type.startsWith("video/")));
      }
    });
    return () => {
      disposed = true;
    };
  }, []);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) || null,
    [assets, selectedAssetId],
  );

  useEffect(() => {
    let disposed = false;
    async function loadPreview() {
      setPreviewUrl(null);
      if (!selectedAsset?.storagePath) return;
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("brand-media")
        .createSignedUrl(selectedAsset.storagePath, 5 * 60);
      if (!disposed && !error && data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
      }
    }
    void loadPreview();
    return () => {
      disposed = true;
    };
  }, [selectedAsset]);

  useEffect(() => {
    const activeJobs = jobs.filter((job) => ACTIVE_STATUSES.has(job.status));
    if (!activeJobs.length) return;
    let disposed = false;

    async function poll() {
      for (const job of activeJobs) {
        try {
          const response = await fetch(`/api/integrations/tiktok/jobs/${job.id}`, {
            cache: "no-store",
          });
          const payload = (await response.json()) as {
            ok?: boolean;
            data?: SafeTikTokPublishJob;
            error?: string;
          };
          if (!disposed && response.ok && payload.ok && payload.data) {
            setJobs((current) =>
              current.map((item) => (item.id === job.id ? payload.data! : item)),
            );
          }
        } catch {
          // Polling is best-effort and bounded on the server.
        }
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 6000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [jobs]);

  const uploadAllowed = Boolean(view?.uploadToDraftEnabled && view.status === "connected" && betaAllowed);

  async function submitUpload() {
    const mediaAssetId = selectedAssetId.trim();
    if (!mediaAssetId) {
      setMessage("Choose a completed video from the Media Library.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/tiktok/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaAssetId,
          caption,
          hashtags: hashtags
            .split(/[\s,]+/)
            .map((tag) => tag.trim())
            .filter(Boolean),
          consent,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: SafeTikTokPublishJob;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Unable to start the TikTok upload.");
      }
      setJobs((current) => [payload.data!, ...current.filter((job) => job.id !== payload.data!.id)]);
      setMessage("TikTok accepted the upload. Monitor the job history below until inbox delivery is confirmed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function refreshJob(jobId: string) {
    try {
      const response = await fetch(`/api/integrations/tiktok/jobs/${jobId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: SafeTikTokPublishJob;
        error?: string;
      };
      if (response.ok && payload.ok && payload.data) {
        setJobs((current) =>
          current.map((item) => (item.id === jobId ? payload.data! : item)),
        );
        setMessage("TikTok job status refreshed.");
      }
    } catch {
      setMessage("Unable to refresh this TikTok job right now.");
    }
  }

  return (
    <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_18px_50px_rgba(76,61,139,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Beta upload</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Upload a completed video to TikTok drafts</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Select a finished video, add copy and hashtags, confirm consent, and send it to TikTok&apos;s inbox/drafts workflow.
          </p>
        </div>
        <div className="space-y-2 text-right text-xs text-slate-500">
          <p>{view?.status === "connected" ? "Connection ready" : "TikTok reconnect required"}</p>
          <p>{betaAllowed ? "Beta access allowed" : betaMessage || "Beta access is currently disabled."}</p>
          {view?.status === "reconnect_required" ? (
            <Link href="/api/integrations/tiktok/connect" className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-semibold text-amber-800">
              Reconnect TikTok
            </Link>
          ) : null}
        </div>
      </div>

      {!uploadAllowed ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          TikTok uploads are disabled until the connection is healthy and the workspace is beta-allowed.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Completed video
            <select
              value={selectedAssetId}
              onChange={(event) => setSelectedAssetId(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800"
            >
              <option value="">Choose a completed video</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Caption
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={2200}
              className="mt-1 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800"
              placeholder="Write a safe, clear caption for the TikTok upload"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="block text-sm font-medium text-slate-700">
              Hashtags
              <input
                value={hashtags}
                onChange={(event) => setHashtags(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800"
                placeholder="#brand #newdrop"
              />
            </label>
            <p className="text-xs text-slate-500">
              {caption.length} / 2200 characters
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1"
            />
            I confirm this upload is approved for TikTok beta delivery and may be sent to the TikTok inbox/drafts workflow.
          </label>

          <button
            type="button"
            onClick={() => void submitUpload()}
            disabled={busy || !uploadAllowed}
            className="pm-primary-button rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Starting upload…" : "Upload to TikTok drafts"}
          </button>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Preview</h3>
            {previewUrl ? (
              <video
                src={previewUrl}
                controls
                className="mt-3 aspect-[9/16] w-full rounded-2xl bg-black object-cover"
              />
            ) : selectedAsset ? (
              <div className="mt-3 aspect-[9/16] rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Preview will load once a signed URL is ready for {selectedAsset.name}.
              </div>
            ) : (
              <div className="mt-3 aspect-[9/16] rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Pick a completed video to see a preview.
              </div>
            )}
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Inbox delivery notes</p>
            <p>TikTok will only show <span className="font-semibold">inbox_delivered</span> after the provider confirms the handoff.</p>
            <p>Open TikTok&apos;s inbox notification to finish edits and post from the app.</p>
          </div>

          <div className="space-y-2 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Warnings</p>
            {betaMessage ? <p>{betaMessage}</p> : null}
            {view?.message ? <p>{view.message}</p> : null}
            {view?.verifiedMediaReady ? <p>Verified media prefix is ready for pull-from-URL delivery.</p> : <p>Verified media prefix is not ready yet.</p>}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-900">Recent jobs</h3>
        {jobs.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">No TikTok jobs yet.</p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Retry</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-900">{statusLabel(job.status)}</td>
                    <td className="px-4 py-3 text-slate-600">{job.progress}%</td>
                    <td className="px-4 py-3 text-slate-600">{job.message}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {job.retryable ? (
                        <button
                          type="button"
                          onClick={() => void refreshJob(job.id)}
                          className="font-semibold text-violet-700"
                        >
                          Refresh
                        </button>
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}