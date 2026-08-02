import AppShell from "@/components/AppShell";
import Link from "next/link";
import { DemoBadge } from "@/components/creators/CreatorUi";
import { loadCreatorHubData } from "@/features/creators/repository";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const route = await params;
  const context = await requireWorkspaceContext();
  const data = await loadCreatorHubData({ workspaceId: context.workspaceId, userId: context.userId });
  const creator = data.creators.find((item) => item.id === route.creatorId);
  const recommendation = data.recommendations.find((item) => item.creatorId === route.creatorId);

  if (!creator) {
    return (
      <AppShell title="Creator Profile" eyebrow="Creator details and campaign history">
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6">
          <p className="text-lg font-black text-slate-900">Creator not found for this workspace.</p>
          <Link href="/creators/discover" className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Back to discover</Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title={creator.displayName} eyebrow="Creator profile">
      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">{creator.handle} · {creator.location}</p>
          <DemoBadge />
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Overview</h2>
        <p className="mt-2 text-sm text-slate-700">{creator.bio}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Followers</p><p className="text-xl font-black text-slate-900">{creator.followerCount.toLocaleString()}</p></article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Average views</p><p className="text-xl font-black text-slate-900">{creator.averageViews.toLocaleString()}</p></article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Engagement</p><p className="text-xl font-black text-slate-900">{(creator.engagementRate * 100).toFixed(1)}%</p></article>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-6">
          <h3 className="text-lg font-black text-slate-900">Platforms</h3>
          <div className="mt-3 space-y-2">
            {creator.platforms.map((platform) => (
              <div key={platform.platform} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{platform.platform} · {platform.handle}</p>
                <p className="mt-1">Followers {platform.followers.toLocaleString()} · Avg views {platform.averageViews.toLocaleString()} · Engagement {(platform.engagementRate * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white/90 p-6">
          <h3 className="text-lg font-black text-slate-900">Audience and pricing</h3>
          <p className="mt-2 text-sm text-slate-700">{creator.audienceSummary}</p>
          <p className="mt-2 text-sm text-slate-700">Pricing: ${creator.estimatedRateMin.toLocaleString()}-${creator.estimatedRateMax.toLocaleString()} {creator.currency}</p>
          <p className="mt-2 text-sm text-slate-700">Availability: {creator.availabilityStatus}</p>
          <p className="mt-2 text-sm text-slate-700">Brand safety: {creator.brandSafetyStatus}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6">
        <h3 className="text-lg font-black text-slate-900">AI match explanation</h3>
        <p className="mt-2 text-sm text-slate-700">Match score {recommendation?.matchScore ?? creator.matchScore}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {(recommendation?.reasons || ["Matches baseline campaign criteria from workspace settings."]).map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        <p className="mt-3 text-sm text-slate-700">Brand compatibility: {creator.niches.join(", ")}</p>
        <p className="mt-1 text-sm text-slate-700">Potential risks: {(recommendation?.concerns || ["No critical concerns in demo profile data."]).join(" ")}</p>
        <p className="mt-1 text-sm text-slate-700">Recommended campaign type: {recommendation?.recommendedCampaignType || "Creator product storytelling"}</p>
        <p className="mt-1 text-sm text-slate-700">Recommended outreach angle: {recommendation?.recommendedOutreachAngle || "Lead with campaign goals and clear deliverables."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/creators/discover" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Save</Link>
          <Link href="/creators/pipeline" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Add to Pipeline</Link>
          <Link href="/creators/campaigns" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Create Campaign</Link>
          <Link href="/creators/pipeline" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Add Note</Link>
          <Link href="/creators/pipeline" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Archive</Link>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-6">
          <h3 className="text-lg font-black text-slate-900">Campaign history</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {data.campaigns.filter((campaign) => campaign.creatorIds.includes(creator.id)).map((campaign) => (
              <p key={campaign.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">{campaign.name} · {campaign.status}</p>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-6">
          <h3 className="text-lg font-black text-slate-900">Activity history</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {data.activity.slice(0, 6).map((item) => (
              <p key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">{item.summary}</p>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
