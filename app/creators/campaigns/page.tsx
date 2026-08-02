import AppShell from "@/components/AppShell";
import { DemoBadge, EmptyPanel } from "@/components/creators/CreatorUi";
import { CREATOR_EMPTY_STATES } from "@/features/creators/empty-states";
import { loadCreatorHubData } from "@/features/creators/repository";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export default async function CreatorCampaignsPage() {
  const context = await requireWorkspaceContext();
  const data = await loadCreatorHubData({ workspaceId: context.workspaceId, userId: context.userId });

  return (
    <AppShell title="Creator Campaigns" eyebrow="Campaign builder and creator assignment workflow">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-black tracking-tight text-slate-900">Campaign Builder</h2>
          <DemoBadge />
        </div>
        <p className="mt-2 text-sm text-slate-600">Build creator campaigns with budget, timeline, selected creators, deliverables, and approval rules.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm text-slate-700">Campaign name<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="Creator Sprint Q3" /></label>
          <label className="text-sm text-slate-700">Goal<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="Drive awareness and product trial" /></label>
          <label className="text-sm text-slate-700">Products/services<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="Trail snack bundle" /></label>
          <label className="text-sm text-slate-700">Budget<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="15000" /></label>
          <label className="text-sm text-slate-700">Timeline<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="Aug 10 - Sep 20" /></label>
          <label className="text-sm text-slate-700">Platforms<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="TikTok, Instagram, YouTube" /></label>
          <label className="text-sm text-slate-700">Selected creators<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="@trailfueljosh, @urbanrunnerkai" /></label>
          <label className="text-sm text-slate-700">Deliverables<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="4 videos, 2 captions, 2 thumbnails" /></label>
          <label className="text-sm text-slate-700">Due dates<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="Weekly Mondays" /></label>
          <label className="text-sm text-slate-700">Approval rules<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="All posts require approver sign-off" /></label>
          <label className="text-sm text-slate-700">Usage rights notes<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="90-day paid usage rights" /></label>
          <label className="text-sm text-slate-700">Tracking link/code placeholder<input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" defaultValue="TRACKING_CODE_PLACEHOLDER" /></label>
        </div>
        <label className="mt-3 block text-sm text-slate-700">Internal notes<textarea className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" rows={3} defaultValue="Demo workflow: campaign builder simulation for beta." /></label>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Existing creator campaigns</p>
        {data.campaigns.length === 0 ? (
          <EmptyPanel title={CREATOR_EMPTY_STATES.campaigns.title} description={CREATOR_EMPTY_STATES.campaigns.description} />
        ) : (
          <div className="mt-4 space-y-3">
            {data.campaigns.map((campaign) => (
              <article key={campaign.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{campaign.name}</p>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{campaign.status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{campaign.goal}</p>
                <p className="mt-1 text-xs text-slate-500">Budget ${campaign.budget.toLocaleString()} {campaign.currency} · {campaign.startDate} to {campaign.endDate}</p>
                <p className="mt-1 text-xs text-slate-500">Creators: {campaign.creatorIds.join(", ")}</p>
                <p className="mt-1 text-xs text-slate-500">Deliverables: {campaign.deliverables.join(" · ")}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
