"use client";

import { useState } from "react";
import type { TikTokConnectionView } from "@/features/integrations/tiktok/types";

type StatusResponse = {
  ok: boolean;
  data?: TikTokConnectionView;
  error?: string;
};

const statusStyles: Record<TikTokConnectionView["status"], string> = {
  disconnected: "border-zinc-600 bg-zinc-800/60 text-zinc-200",
  connecting: "border-blue-500/60 bg-blue-500/10 text-blue-200",
  connected: "border-emerald-500/60 bg-emerald-500/10 text-emerald-200",
  expired: "border-amber-500/60 bg-amber-500/10 text-amber-200",
  error: "border-red-500/60 bg-red-500/10 text-red-200",
};

function statusLabel(status: TikTokConnectionView["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
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
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-red-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-red-500/30 bg-black/60 p-6 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-400">
            Social publishing connection
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            TikTok Integration
          </h1>
          <p className="mt-2 text-sm text-zinc-300">
            Connect a TikTok sandbox account for secure profile discovery and
            private-only posting tests.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
              Sandbox
            </span>
            <span className="rounded-full border border-blue-500/60 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
              OAuth 2.0
            </span>
            <span className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              User-approved access
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-red-500/25 bg-black/55 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Connection status</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Tokens are encrypted and stored per workspace.
              </p>
            </div>
            {view ? (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[view.status]}`}
              >
                {statusLabel(view.status)}
              </span>
            ) : null}
          </div>

          {busy && !view ? (
            <p className="mt-5 text-sm text-zinc-300">Loading connection…</p>
          ) : null}
          {message ? (
            <p className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              {message}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={connect}
              disabled={busy || !view?.configured}
              className="rounded-lg bg-[#fe2c55] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e9234b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {view?.status === "connected"
                ? "Reconnect TikTok"
                : "Connect TikTok"}
            </button>
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={busy}
              className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-50"
            >
              Refresh status
            </button>
            {view?.status === "connected" ? (
              <button
                type="button"
                onClick={() => void disconnect()}
                disabled={busy}
                className="rounded-lg border border-red-500/50 px-5 py-2.5 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-50"
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#111827] p-6">
            <h2 className="text-xl font-semibold">Connected creator</h2>
            {view?.creator ? (
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-zinc-500">Display name</dt>
                  <dd className="mt-1 font-semibold text-white">
                    {view.creator.nickname || "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Username</dt>
                  <dd className="mt-1 text-zinc-200">
                    {view.creator.username
                      ? `@${view.creator.username}`
                      : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Maximum video length</dt>
                  <dd className="mt-1 text-zinc-200">
                    {view.creator.maxVideoDurationSeconds
                      ? `${view.creator.maxVideoDurationSeconds} seconds`
                      : "Reported after connection"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-zinc-400">
                Creator details appear after TikTok authorization.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111827] p-6">
            <h2 className="text-xl font-semibold">Permission checklist</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {["user.info.basic", "video.publish"].map((scope) => {
                const granted = view?.scopes.includes(scope) ?? false;
                return (
                  <li
                    key={scope}
                    className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2"
                  >
                    <code>{scope}</code>
                    <span
                      className={
                        granted ? "text-emerald-300" : "text-zinc-500"
                      }
                    >
                      {granted ? "Granted" : "Pending"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">
          <h2 className="font-bold">Sandbox publishing restriction</h2>
          <p className="mt-1">
            TikTok restricts posts from unaudited clients to private visibility.
            PostMotive will not offer public posting until TikTok approves the
            production integration.
          </p>
        </section>
      </div>
    </main>
  );
}
