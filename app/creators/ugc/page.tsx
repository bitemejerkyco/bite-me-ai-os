import AppShell from "@/components/AppShell";
import Link from "next/link";
import { DemoBadge, EmptyPanel } from "@/components/creators/CreatorUi";
import { CREATOR_EMPTY_STATES } from "@/features/creators/empty-states";
import { loadCreatorHubData } from "@/features/creators/repository";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export default async function CreatorUgcPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireWorkspaceContext();
  const data = await loadCreatorHubData({ workspaceId: context.workspaceId, userId: context.userId });
  const query = await searchParams;

  const creatorFilter = String(query.creator || "ALL");
  const campaignFilter = String(query.campaign || "ALL");
  const platformFilter = String(query.platform || "ALL");
  const assetTypeFilter = String(query.assetType || "ALL");

  const assets = data.ugcAssets.filter((asset) => {
    if (creatorFilter !== "ALL" && asset.creatorId !== creatorFilter) return false;
    if (campaignFilter !== "ALL" && asset.campaignId !== campaignFilter) return false;
    if (platformFilter !== "ALL" && asset.platform !== platformFilter) return false;
    if (assetTypeFilter !== "ALL" && asset.assetType !== assetTypeFilter) return false;
    return true;
  });

  return (
    <AppShell title="UGC Library" eyebrow="Approved creator assets and usage-rights management">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-700">Every approved creator asset can be moved into a reusable UGC library and optionally attached to campaigns or the Media Library.</p>
          <DemoBadge />
        </div>

        <form method="get" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-700">Creator
            <select name="creator" defaultValue={creatorFilter} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              <option value="ALL">All</option>
              {data.creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.displayName}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Campaign
            <select name="campaign" defaultValue={campaignFilter} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              <option value="ALL">All</option>
              {data.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Platform
            <select name="platform" defaultValue={platformFilter} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              <option value="ALL">All</option>
              {[...new Set(data.ugcAssets.map((asset) => asset.platform))].map((platform) => <option key={platform} value={platform}>{platform}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Asset type
            <select name="assetType" defaultValue={assetTypeFilter} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              <option value="ALL">All</option>
              {[...new Set(data.ugcAssets.map((asset) => asset.assetType))].map((assetType) => <option key={assetType} value={assetType}>{assetType}</option>)}
            </select>
          </label>
          <div className="md:col-span-2 xl:col-span-4 flex gap-2">
            <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Apply filters</button>
            <Link href="/creators/ugc" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Reset</Link>
          </div>
        </form>
      </section>

      {assets.length === 0 ? (
        <EmptyPanel title={CREATOR_EMPTY_STATES.ugc.title} description={CREATOR_EMPTY_STATES.ugc.description} />
      ) : (
        <section className="space-y-3">
          {assets.map((asset) => (
            <article key={asset.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{asset.title}</p>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">{asset.assetType}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Creator {asset.creatorId} · Campaign {asset.campaignId || "None"} · {asset.platform}</p>
              <p className="mt-1 text-xs text-slate-500">Rights {asset.usageRightsStart || "n/a"} to {asset.usageRightsEnd || "n/a"} · {asset.approvalStatus}</p>
              <p className="mt-1 text-xs text-slate-500">Tags: {asset.tags.join(", ")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Preview</button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Download (where permitted)</button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Add to Campaign</button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Add to Media Library</button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Duplicate Brief</button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Archive</button>
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
