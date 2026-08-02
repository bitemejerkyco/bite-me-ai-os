import AppShell from "@/components/AppShell";
import Link from "next/link";
import { DemoBadge, EmptyPanel, MetricTile } from "@/components/creators/CreatorUi";
import { CREATOR_RECOMMENDATION_LABEL } from "@/features/creators/recommendations";
import { loadCreatorHubData } from "@/features/creators/repository";
import { CREATOR_EMPTY_STATES } from "@/features/creators/empty-states";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

function money(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "Not measured";
  return `$${value.toLocaleString()}`;
}

export default async function CreatorDashboardPage() {
  const context = await requireWorkspaceContext();
  const data = await loadCreatorHubData({ workspaceId: context.workspaceId, userId: context.userId });

  const savedCreators = data.creators.filter((item) => item.saved).length;
  const awaitingOutreach = data.pipeline.filter((item) => ["DISCOVERED", "AI_RECOMMENDED", "SAVED"].includes(item.stage)).length;
  const pendingReview = data.submissions.filter((item) => item.status === "SUBMITTED" || item.status === "IN_REVIEW" || item.status === "REVISION_REQUESTED").length;
  const approvedUgc = data.ugcAssets.filter((item) => item.approvalStatus === "APPROVED").length;
  const activeCampaigns = data.campaigns.filter((item) => ["ACTIVE", "CONTENT_REVIEW", "LIVE", "SCHEDULED"].includes(item.status)).length;
  const topCreators = [...data.creators].sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);

  return (
    <AppShell title="Creator Hub" eyebrow="Creator relationships, UGC, and campaign execution">
      {data.isDemo ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-amber-900">Creator Hub beta is currently running with demo creator workflow data.</p>
            <DemoBadge />
          </div>
          <p className="mt-2 text-sm text-amber-800">Measured revenue is only shown when deterministic tracked values exist. Demo records do not imply live platform integrations.</p>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Creator Brief</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Three creators closely match your brand and current campaign goals. Two creator assets are awaiting review.</h2>
        <p className="mt-2 text-sm text-slate-600">{CREATOR_RECOMMENDATION_LABEL}</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Active creator campaigns" value={String(activeCampaigns)} status={data.isDemo ? "demo" : "measured"} />
        <MetricTile label="Saved creators" value={String(savedCreators)} status={data.isDemo ? "demo" : "measured"} />
        <MetricTile label="Creators awaiting outreach" value={String(awaitingOutreach)} status={data.isDemo ? "demo" : "measured"} />
        <MetricTile label="Pending content reviews" value={String(pendingReview)} status={data.isDemo ? "demo" : "measured"} />
        <MetricTile label="Approved UGC assets" value={String(approvedUgc)} status={data.isDemo ? "demo" : "measured"} />
        <MetricTile label="Estimated campaign spend" value={money(data.analytics.estimated.campaignSpend)} status={data.analytics.estimated.campaignSpend === null ? "demo" : "estimated"} />
        <MetricTile label="Measured creator revenue" value={money(data.analytics.measured.revenue)} status={data.analytics.measured.revenue === null ? "demo" : "measured"} />
        <MetricTile label="Top-performing creators" value={String(topCreators.length)} status={data.isDemo ? "demo" : "measured"} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6" data-help="creator-top-actions">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Top Actions</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/creators/discover" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Review creator recommendations</Link>
            <Link href="/creators/campaigns" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">Create creator campaign</Link>
            <Link href="/creators/content-review" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">Review submitted content</Link>
            <Link href="/creators/pipeline" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">Open creator pipeline</Link>
          </div>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">AI creator recommendations</p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {data.recommendations.slice(0, 3).map((item) => (
              <div key={item.creatorId} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="font-semibold text-slate-900">Creator {item.creatorId} · Match {item.matchScore}</p>
                <p className="mt-1">{item.reasons[0]}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6" data-help="creator-recent-activity">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Recent Activity</p>
        {data.activity.length === 0 ? (
          <EmptyPanel title={CREATOR_EMPTY_STATES.dashboard.title} description={CREATOR_EMPTY_STATES.dashboard.description} />
        ) : (
          <div className="mt-4 space-y-3">
            {data.activity.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.summary}</p>
                  <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.eventType}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
