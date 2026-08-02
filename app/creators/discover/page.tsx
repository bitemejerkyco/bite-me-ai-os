import AppShell from "@/components/AppShell";
import Link from "next/link";
import { CreatorCard, DemoBadge, EmptyPanel } from "@/components/creators/CreatorUi";
import { CREATOR_EMPTY_STATES } from "@/features/creators/empty-states";
import { filterCreators } from "@/features/creators/filter";
import { CREATOR_RECOMMENDATION_LABEL } from "@/features/creators/recommendations";
import { loadCreatorHubData } from "@/features/creators/repository";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

function toNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function DiscoverCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireWorkspaceContext();
  const data = await loadCreatorHubData({ workspaceId: context.workspaceId, userId: context.userId });
  const query = await searchParams;

  const platform = String(query.platform || "ALL");
  const niche = String(query.niche || "ALL");
  const location = String(query.location || "").toLowerCase();
  const minFollowers = toNumber(String(query.minFollowers || ""));
  const minViews = toNumber(String(query.minViews || ""));
  const minEngagement = query.minEngagement ? Number(query.minEngagement) : null;
  const maxRate = toNumber(String(query.maxRate || ""));
  const availability = String(query.availability || "ALL");
  const safety = String(query.safety || "ALL");
  const minMatch = toNumber(String(query.minMatch || ""));

  const creators = filterCreators(data.creators, {
    platform,
    niche,
    location,
    minFollowers,
    minViews,
    minEngagement,
    maxRate,
    availability,
    safety,
    minMatch,
  });

  const platformOptions = [...new Set(data.creators.flatMap((item) => item.platforms.map((platformItem) => platformItem.platform)))];
  const nicheOptions = [...new Set(data.creators.flatMap((item) => item.niches))];

  return (
    <AppShell title="Discover Creators" eyebrow="Search, filters, and AI-ranked creator fit">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">Find creator profiles by audience fit, platform strength, availability, and brand safety.</p>
          <DemoBadge />
        </div>
        <p className="mt-2 text-xs text-slate-500">{CREATOR_RECOMMENDATION_LABEL}</p>

        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5" method="get">
          <label className="text-sm text-slate-700">Platform
            <select name="platform" defaultValue={platform} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              <option value="ALL">All</option>
              {platformOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Niche
            <select name="niche" defaultValue={niche} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              <option value="ALL">All</option>
              {nicheOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Location
            <input name="location" defaultValue={String(query.location || "")} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="City or state" />
          </label>
          <label className="text-sm text-slate-700">Min followers
            <input name="minFollowers" defaultValue={String(query.minFollowers || "")} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="10000" />
          </label>
          <label className="text-sm text-slate-700">Min views
            <input name="minViews" defaultValue={String(query.minViews || "")} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="5000" />
          </label>
          <label className="text-sm text-slate-700">Min engagement rate
            <input name="minEngagement" defaultValue={String(query.minEngagement || "")} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="0.05" />
          </label>
          <label className="text-sm text-slate-700">Max estimated rate
            <input name="maxRate" defaultValue={String(query.maxRate || "")} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="2000" />
          </label>
          <label className="text-sm text-slate-700">Availability
            <select name="availability" defaultValue={availability} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              <option value="ALL">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="LIMITED">Limited</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">Brand safety
            <select name="safety" defaultValue={safety} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              <option value="ALL">All</option>
              <option value="SAFE">Safe</option>
              <option value="REVIEW">Review</option>
              <option value="RESTRICTED">Restricted</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">AI match score min
            <input name="minMatch" defaultValue={String(query.minMatch || "")} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="70" />
          </label>
          <div className="md:col-span-2 xl:col-span-5 flex gap-2">
            <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Apply filters</button>
            <Link href="/creators/discover" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Clear filters</Link>
          </div>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {creators.length === 0 ? (
          <EmptyPanel title={CREATOR_EMPTY_STATES.discover.title} description={CREATOR_EMPTY_STATES.discover.description} />
        ) : creators.map((creator) => (
          <CreatorCard
            key={creator.id}
            creator={creator}
            whyMatch={data.recommendations.find((item) => item.creatorId === creator.id)?.reasons[0] || "Matches baseline demographic and platform criteria."}
            actions={[
              { href: `/creators/${creator.id}`, label: "View profile" },
              { href: "/creators/pipeline", label: "Add to pipeline" },
              { href: "/creators/campaigns", label: "Add to campaign" },
            ]}
          />
        ))}
      </section>
    </AppShell>
  );
}
