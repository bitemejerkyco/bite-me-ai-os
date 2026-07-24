"use client";

import { useState } from "react";
import type {
  AmazonAdsAdvertiserProfile,
  AmazonAdsConnectionView,
} from "@/features/marketing/providers/amazon-ads/live/types";

type StatusPayload = {
  ok: boolean;
  data?: AmazonAdsConnectionView | { message?: string };
  error?: string;
};

type AmazonAdsIntegrationSettingsProps = {
  initialView: AmazonAdsConnectionView | null;
  initialError: string | null;
};

const statusClass: Record<AmazonAdsConnectionView["status"], string> = {
  disconnected: "border-zinc-600/80 bg-zinc-800/40 text-zinc-200",
  connecting: "border-blue-500/70 bg-blue-500/10 text-blue-200",
  connected: "border-emerald-500/70 bg-emerald-500/10 text-emerald-200",
  expired: "border-amber-500/70 bg-amber-500/10 text-amber-200",
  error: "border-red-500/70 bg-red-500/10 text-red-200",
};

const labelMap: Record<AmazonAdsConnectionView["status"], string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  expired: "Expired",
  error: "Error",
};

async function parseResponse(response: Response): Promise<StatusPayload> {
  return (await response.json()) as StatusPayload;
}

function getInitialSelection(view: AmazonAdsConnectionView | null): {
  profileId: string;
  marketplaceId: string;
} {
  if (!view) {
    return {
      profileId: "",
      marketplaceId: "",
    };
  }
  const profileId = view.selectedProfileId || view.profiles[0]?.profileId || "";
  const profile = view.profiles.find((row) => row.profileId === profileId) || null;
  return {
    profileId,
    marketplaceId: view.selectedMarketplaceId || profile?.marketplaceId || "",
  };
}

export default function AmazonAdsIntegrationSettings({
  initialView,
  initialError,
}: AmazonAdsIntegrationSettingsProps) {
  const [view, setView] = useState<AmazonAdsConnectionView | null>(initialView);
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>((initialView?.csrfToken || "").trim());
  const [selectedProfileId, setSelectedProfileId] = useState<string>(getInitialSelection(initialView).profileId);
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>(getInitialSelection(initialView).marketplaceId);

  async function loadStatus() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/amazon-ads/status", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await parseResponse(response);
      if (!response.ok || !payload.data || !("status" in payload.data)) {
        throw new Error(payload.error || "Unable to load Amazon Ads integration status.");
      }
      setView(payload.data);
      setCsrfToken((payload.data.csrfToken || "").trim());
      const selection = getInitialSelection(payload.data);
      setSelectedProfileId(selection.profileId);
      setSelectedMarketplaceId(selection.marketplaceId);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  const selectedProfile: AmazonAdsAdvertiserProfile | null =
    view?.profiles.find((row) => row.profileId === selectedProfileId) || null;

  const canConnect = Boolean(view?.featureEnabled) && !busy;
  const canSelectProfile =
    view?.status === "connected" && Boolean(view.connectionId) && Boolean(selectedProfileId) && Boolean(selectedMarketplaceId);
  const canDisconnect = view?.status === "connected" && Boolean(view.connectionId) && !busy;

  function handleConnect() {
    window.location.href = "/api/integrations/amazon-ads/connect";
  }

  async function handleSaveSelection() {
    if (!view?.connectionId) return;
    if (!csrfToken) {
      setError("Session CSRF token is missing. Reload status and try again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/amazon-ads/select-profile", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          connectionId: view.connectionId,
          profileId: selectedProfileId,
          marketplaceId: selectedMarketplaceId,
        }),
      });
      const payload = await parseResponse(response);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to save profile selection.");
      }
      await loadStatus();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!view?.connectionId) return;
    if (!csrfToken) {
      setError("Session CSRF token is missing. Reload status and try again.");
      return;
    }
    const confirmed = window.confirm(
      "Disconnect Amazon Ads and remove local credentials? Remote Amazon token revocation will be attempted.",
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/amazon-ads/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ connectionId: view.connectionId, confirmed: true }),
      });
      const payload = await parseResponse(response);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to disconnect Amazon Ads.");
      }
      if (payload.data?.message) {
        setError(payload.data.message);
      }
      await loadStatus();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-red-950 px-4 py-6 text-zinc-100 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-red-500/30 bg-black/60 p-6 shadow-xl">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Amazon Ads Integration</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Configure secure Amazon Ads OAuth access for live read-only profile discovery.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
              Live Read Only
            </span>
            <span className="rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
              No campaign changes
            </span>
            <span className="rounded-full border border-zinc-600 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-300">
              Sandbox analytics remains available
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-red-500/25 bg-black/55 p-6">
          <h2 className="text-xl font-semibold text-zinc-100">Connection status</h2>
          {view ? (
            <div className="mt-3 space-y-3">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass[view.status]}`}>
                {labelMap[view.status]}
              </span>
              <p className="text-sm text-zinc-300">
                {view.featureEnabled
                  ? "Live read-only access can be connected for advertiser profile discovery."
                  : "Live read-only mode is currently disabled by AMAZON_ADS_LIVE_READ_ENABLED=false."}
              </p>
              {view.expiresAt ? (
                <p className="text-xs text-zinc-400">
                  Access token expires at: {new Date(view.expiresAt).toISOString()}
                </p>
              ) : null}
              {view.message ? <p className="text-sm text-amber-200">{view.message}</p> : null}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-zinc-300">{busy ? "Loading status..." : "No status available."}</p>
              <button
                type="button"
                onClick={() => void loadStatus()}
                disabled={busy}
                className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retry status check
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canConnect}
              onClick={handleConnect}
              className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Connect Amazon Ads
            </button>
            <button
              type="button"
              disabled={!canDisconnect}
              onClick={handleDisconnect}
              className="rounded-md border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-red-500/25 bg-black/55 p-6">
          <h2 className="text-xl font-semibold text-zinc-100">Advertiser profile selection</h2>
          <p className="mt-1 text-sm text-zinc-300">
            Select a profile and marketplace before any future live read operations are enabled.
          </p>

          {view && view.profiles.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-zinc-300">
                Advertiser profile
                <select
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
                  value={selectedProfileId}
                  onChange={(event) => {
                    const profileId = event.target.value;
                    setSelectedProfileId(profileId);
                    const profile = view.profiles.find((row) => row.profileId === profileId);
                    setSelectedMarketplaceId(profile?.marketplaceId || "");
                  }}
                >
                  {view.profiles.map((profile) => (
                    <option key={profile.profileId} value={profile.profileId}>
                      {profile.accountName} ({profile.profileId})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-zinc-300">
                Marketplace
                <input
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
                  value={selectedMarketplaceId}
                  readOnly
                  aria-readonly
                />
              </label>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">
              No advertiser profiles discovered yet. Complete OAuth connection first.
            </p>
          )}

          {selectedProfile ? (
            <p className="mt-3 text-xs text-zinc-400">
              Selected account type: {selectedProfile.accountType} • Currency: {selectedProfile.currencyCode}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!canSelectProfile || busy}
            onClick={handleSaveSelection}
            className="mt-4 rounded-md border border-amber-500/60 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save profile selection
          </button>
        </section>

        {error ? (
          <section className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </section>
        ) : null}
      </div>
    </main>
  );
}
