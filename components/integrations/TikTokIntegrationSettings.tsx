"use client";

import { useState } from "react";
import type { TikTokConnectionView } from "@/features/integrations/tiktok/types";

type StatusResponse = {
  ok: boolean;
  data?: TikTokConnectionView;
  error?: string;
};

const statusStyles: Record<TikTokConnectionView["status"], string> = {
  disconnected: "border-slate-200 bg-slate-50 text-slate-600",
  connecting: "border-blue-200 bg-blue-50 text-blue-700",
  connected: "border-emerald-200 bg-emerald-50 text-emerald-700",
  expired: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  reconnect_required: "border-orange-200 bg-orange-50 text-orange-700",
};

function statusLabel(status: TikTokConnectionView["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function modeLabel(mode: TikTokConnectionView["postingMode"]): string {
  return mode.replaceAll("_", " ");
}

type TikTokIntegrationSettingsProps = {
  initialView: TikTokConnectionView | null;
  initialMessage: string | null;
};

export default function TikTokIntegrationSettings({
  initialView,
  initialMessage,
}: TikTokIntegrationSettingsProps) {
  const [view, setView] = useState<TikTokConnectionView | null>(initialView);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage);

  async function loadStatus() {
    setBusy(true);
    try {
      const response = await fetch("/api/integrations/tiktok/status", {
        cache: "no-store",
      });
      const payload = (await response.json()) as StatusResponse;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Unable to load TikTok status.");
      }
      setView(payload.data);
      if (payload.data.message) setMessage(payload.data.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function connect() {
    window.location.href = "/api/integrations/tiktok/connect";
  }

  async function disconnect() {
    if (!window.confirm("Disconnect this TikTok account from PostMotive?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/tiktok/disconnect", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { warning?: string | null };
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to disconnect TikTok.");
      }
      setMessage(payload.data?.warning || "TikTok disconnected.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  return (
    <main className="pm-content min-h-screen bg-gradient-to-br from-violet-50/80 via-white/60 to-cyan-50/80 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="pm-glass relative overflow-hidden rounded-[2rem] p-7">
          <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-[42%_58%_60%_40%] bg-gradient-to-br from-cyan-200 to-violet-200 opacity-70" />
          <p className="relative text-xs font-bold uppercase tracking-[0.24em] text-violet-600">
            Social publishing connection
          </p>
          <h1 className="relative mt-2 text-3xl font-black tracking-[-0.035em] md:text-4xl">
            TikTok Integration
          </h1>
          <p className="relative mt-2 text-sm text-slate-600">
            Connect a TikTok account for controlled beta uploads, with direct
            post kept behind explicit approval and scope checks.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800">
              Beta upload ready
            </span>
            <span className="rounded-full border border-blue-500/60 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700">
              OAuth 2.0
            </span>
            <span className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
              User-approved access
            </span>
          </div>
        </header>

        <section className="rounded-[2rem] border border-white bg-white/80 p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Connection status</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tokens are encrypted and stored per workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {view ? (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[view.status]}`}
                >
                  {statusLabel(view.status)}
                </span>
              ) : null}
              {view?.postingMode ? (
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  {modeLabel(view.postingMode)}
                </span>
              ) : null}
            </div>
          </div>

          {busy && !view ? (
            <p className="mt-5 text-sm text-slate-700">Loading connection…</p>
          ) : null}
          {message ? (
            <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
              {message}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={connect}
              disabled={busy || !view?.configured || view?.postingMode === "disabled"}
              className="pm-primary-button rounded-xl px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {view?.status === "connected"
                ? "Reconnect TikTok"
                : "Connect TikTok"}
            </button>
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={busy}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-700 hover:bg-violet-50 disabled:opacity-50"
            >
              Refresh status
            </button>
            {view?.status === "connected" ? (
              <button
                type="button"
                onClick={() => void disconnect()}
                disabled={busy}
                className="rounded-xl border border-rose-300 px-5 py-2.5 text-sm text-rose-700 hover:bg-violet-500/10 disabled:opacity-50"
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6">
            <h2 className="text-xl font-semibold">Connected creator</h2>
            {view?.creator ? (
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-slate-400">Display name</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {view.creator.nickname || "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Username</dt>
                  <dd className="mt-1 text-slate-700">
                    {view.creator.username
                      ? `@${view.creator.username}`
                      : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Maximum video length</dt>
                  <dd className="mt-1 text-slate-700">
                    {view.creator.maxVideoDurationSeconds
                      ? `${view.creator.maxVideoDurationSeconds} seconds`
                      : "Reported after connection"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Creator details appear after TikTok authorization.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6">
            <h2 className="text-xl font-semibold">Permission checklist</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {["user.info.basic", "video.upload", "video.publish"].map((scope) => {
                const granted = view?.scopes.includes(scope) ?? false;
                return (
                  <li
                    key={scope}
                    className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2"
                  >
                    <code>{scope}</code>
                    <span
                      className={
                        granted ? "text-emerald-700" : "text-slate-400"
                      }
                    >
                      {granted ? "Granted" : "Pending"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 px-3 py-2">
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Token health</dt>
                <dd className="mt-1 font-semibold text-slate-900">{view?.tokenHealth || "missing"}</dd>
              </div>
              <div className="rounded-xl border border-slate-200/80 px-3 py-2">
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Upload-to-Draft</dt>
                <dd className="mt-1 font-semibold text-slate-900">{view?.uploadToDraftEnabled ? "Available" : "Unavailable"}</dd>
              </div>
              <div className="rounded-xl border border-slate-200/80 px-3 py-2">
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Direct Post</dt>
                <dd className="mt-1 font-semibold text-slate-900">{view?.directPostEnabled ? "Available" : "Locked"}</dd>
              </div>
              <div className="rounded-xl border border-slate-200/80 px-3 py-2">
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">Verified media</dt>
                <dd className="mt-1 font-semibold text-slate-900">{view?.verifiedMediaReady ? "Ready" : "Not configured"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-900">
          <h2 className="font-bold">Sandbox publishing</h2>
          <p className="mt-1">
            TikTok sandbox sends videos to the creator as drafts for final
            review and posting. Direct public posting becomes available after
            TikTok approves the production integration.
          </p>
        </section>
      </div>
    </main>
  );
}
