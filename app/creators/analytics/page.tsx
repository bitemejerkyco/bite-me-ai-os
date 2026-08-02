import AppShell from "@/components/AppShell";
import { DemoBadge, EmptyPanel, MetricTile } from "@/components/creators/CreatorUi";
import { CREATOR_EMPTY_STATES } from "@/features/creators/empty-states";
import { loadCreatorHubData } from "@/features/creators/repository";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

function value(value: number | null): string {
  if (value === null) return "Not measured";
  return value.toLocaleString();
}

function money(value: number | null): string {
  if (value === null) return "Not measured";
  return `$${value.toLocaleString()}`;
}

export default async function CreatorAnalyticsPage() {
  const context = await requireWorkspaceContext();
  const data = await loadCreatorHubData({ workspaceId: context.workspaceId, userId: context.userId });
  const metrics = data.analytics.measured;

  return (
    <AppShell title="Creator Analytics" eyebrow="Campaign and creator performance tracking">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-700">Analytics clearly distinguish measured, estimated, and demo values.</p>
          <DemoBadge />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Active campaigns" value={String(metrics.activeCampaigns)} status="measured" />
        <MetricTile label="Creators engaged" value={String(metrics.creatorsEngaged)} status="measured" />
        <MetricTile label="Content submitted" value={String(metrics.contentSubmitted)} status="measured" />
        <MetricTile label="Content approved" value={String(metrics.contentApproved)} status="measured" />
        <MetricTile label="Published assets" value={String(metrics.publishedAssets)} status="measured" />
        <MetricTile label="Reach" value={value(metrics.reach)} status={metrics.reach === null ? "demo" : "measured"} />
        <MetricTile label="Impressions" value={value(metrics.impressions)} status={metrics.impressions === null ? "demo" : "measured"} />
        <MetricTile label="Engagement" value={value(metrics.engagement)} status={metrics.engagement === null ? "demo" : "measured"} />
        <MetricTile label="Clicks" value={value(metrics.clicks)} status={metrics.clicks === null ? "demo" : "measured"} />
        <MetricTile label="Conversions" value={value(metrics.conversions)} status={metrics.conversions === null ? "demo" : "measured"} />
        <MetricTile label="Revenue" value={money(metrics.revenue)} status={metrics.revenue === null ? "demo" : "measured"} />
        <MetricTile label="Campaign spend" value={money(metrics.campaignSpend)} status={metrics.campaignSpend === null ? "demo" : "measured"} />
        <MetricTile label="Cost per engagement" value={money(metrics.costPerEngagement)} status={metrics.costPerEngagement === null ? "demo" : "measured"} />
        <MetricTile label="Cost per acquisition" value={money(metrics.costPerAcquisition)} status={metrics.costPerAcquisition === null ? "demo" : "measured"} />
        <MetricTile label="Creator ROI" value={metrics.creatorRoi === null ? "Not measured" : `${metrics.creatorRoi.toFixed(2)}x`} status={metrics.creatorRoi === null ? "demo" : "measured"} />
        <MetricTile label="Estimated spend" value={money(data.analytics.estimated.campaignSpend)} status="estimated" />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-6">
          <h2 className="text-lg font-black text-slate-900">Campaign performance</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {data.campaigns.map((campaign) => (
              <p key={campaign.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">{campaign.name} · {campaign.status} · Budget ${campaign.budget.toLocaleString()}</p>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-6">
          <h2 className="text-lg font-black text-slate-900">Creator leaderboard</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {[...data.creators].sort((a, b) => b.matchScore - a.matchScore).slice(0, 8).map((creator) => (
              <p key={creator.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">{creator.displayName} · Match {creator.matchScore} · Engagement {(creator.engagementRate * 100).toFixed(1)}%</p>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6">
        <h2 className="text-lg font-black text-slate-900">Content leaderboard and platform trend view</h2>
        <p className="mt-2 text-sm text-slate-600">Content leaderboard, platform comparison, and trend history are simulated with demo records until live integrations are connected.</p>
        {data.ugcAssets.length === 0 ? (
          <div className="mt-4">
            <EmptyPanel title={CREATOR_EMPTY_STATES.analytics.title} description={CREATOR_EMPTY_STATES.analytics.description} />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[...data.ugcAssets].slice(0, 6).map((asset) => (
              <article key={asset.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-sm font-semibold text-slate-900">{asset.title}</p>
                <p className="mt-1 text-xs text-slate-500">{asset.platform} · {asset.assetType}</p>
                <p className="mt-1 text-xs text-slate-600">Measured impressions: {value(asset.performanceMetrics?.impressions || null)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
