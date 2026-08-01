import Link from "next/link";
import AppShell from "@/components/AppShell";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { loadWorkspaceIntegrationDiagnostics } from "@/features/integrations/core/diagnostics";

const STATE_LABELS: Record<string, string> = {
  not_configured: "Not configured",
  connecting: "Connecting",
  connected: "Connected",
  token_expiring: "Token expiring",
  token_expired: "Token expired",
  reconnect_required: "Reconnect required",
  degraded: "Degraded",
  rate_limited: "Rate limited",
  error: "Error",
  disconnected: "Disconnected",
};

const STATE_CLASSNAMES: Record<string, string> = {
  not_configured: "border-slate-200 bg-slate-50 text-slate-700",
  connecting: "border-blue-200 bg-blue-50 text-blue-700",
  connected: "border-emerald-200 bg-emerald-50 text-emerald-700",
  token_expiring: "border-amber-300 bg-amber-50 text-amber-800",
  token_expired: "border-amber-300 bg-amber-50 text-amber-800",
  reconnect_required: "border-orange-300 bg-orange-50 text-orange-800",
  degraded: "border-amber-300 bg-amber-50 text-amber-800",
  rate_limited: "border-amber-300 bg-amber-50 text-amber-800",
  error: "border-rose-300 bg-rose-50 text-rose-800",
  disconnected: "border-slate-200 bg-slate-50 text-slate-700",
};

const SETTINGS_ROUTE: Record<string, string | null> = {
  tiktok: "/settings/integrations/tiktok",
  amazon_ads: "/settings/integrations/amazon-ads",
};

export default async function IntegrationsPage() {
  const context = await requireWorkspaceContext();
  const cards = await loadWorkspaceIntegrationDiagnostics(context.workspaceId);
  const connectedCount = cards.filter((card) => card.state === "connected").length;

  return (
    <AppShell title="Integrations" eyebrow="Connected channels and data sources">
      <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Channel and analytics connections</h2>
        <p className="mt-2 text-sm text-slate-600">
          Connect data sources to improve Marketing Score confidence, revenue visibility, and action recommendations.
        </p>

        <div data-help="integrations-provider-grid" className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const route = SETTINGS_ROUTE[card.providerId] || null;
            return (
              <article data-help="integrations-provider-card" key={card.providerId} className="rounded-2xl border border-slate-200 bg-white/85 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATE_CLASSNAMES[card.state] || STATE_CLASSNAMES.not_configured}`}>
                    {STATE_LABELS[card.state] || card.state}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{card.reason}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Support level: {card.supportLevel.replaceAll("_", " ")}
                  {card.readOnly ? " • Read only" : ""}
                </p>
                {card.recentFailure?.message ? (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Last failure: {card.recentFailure.message}
                  </p>
                ) : null}
                {card.missingScopes.length > 0 ? (
                  <p className="mt-2 text-xs text-amber-800">
                    Missing scopes: {card.missingScopes.join(", ")}
                  </p>
                ) : null}
                {route ? (
                  <Link href={route} className="mt-3 inline-flex rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                    Manage {card.label}
                  </Link>
                ) : (
                  <span className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    No settings page yet
                  </span>
                )}
              </article>
            );
          })}
        </div>

        {connectedCount === 0 ? (
          <div className="mt-5">
            <GuidedEmptyState
              title="No integrations connected"
              description="Connect your first marketing channel to unlock publishing and performance insights."
              estimatedTime="2-4 minutes"
              primaryAction={{ label: "Connect a Channel", href: "/settings/integrations/tiktok" }}
              secondaryAction={{ label: "Send Beta Feedback", href: "/help" }}
            />
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
