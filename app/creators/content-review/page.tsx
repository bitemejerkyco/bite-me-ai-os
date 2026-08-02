import AppShell from "@/components/AppShell";
import { DemoBadge, EmptyPanel } from "@/components/creators/CreatorUi";
import { CREATOR_EMPTY_STATES } from "@/features/creators/empty-states";
import { loadCreatorHubData } from "@/features/creators/repository";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export default async function CreatorContentReviewPage() {
  const context = await requireWorkspaceContext();
  const data = await loadCreatorHubData({ workspaceId: context.workspaceId, userId: context.userId });
  const queue = data.submissions.filter((item) => ["SUBMITTED", "IN_REVIEW", "REVISION_REQUESTED"].includes(item.status));

  return (
    <AppShell title="Creator Content Review" eyebrow="Review creator-submitted content with approval controls">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-700">Submission support: image, video, caption, story concept, Reel/TikTok script, thumbnail, and supporting notes.</p>
          <DemoBadge />
        </div>
      </section>

      {queue.length === 0 ? (
        <EmptyPanel title={CREATOR_EMPTY_STATES.contentReview.title} description={CREATOR_EMPTY_STATES.contentReview.description} />
      ) : (
        <section className="space-y-3">
          {queue.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white/90 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{item.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.assetType} · Creator {item.creatorId} · Campaign {item.campaignId || "None"}</p>
              {item.textBody ? <p className="mt-2 text-sm text-slate-700">{item.textBody}</p> : null}
              {item.supportingNotes ? <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{item.supportingNotes}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Approve</button>
                <button type="button" className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white">Reject</button>
                <button type="button" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Request Revision</button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Comment</button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Save to UGC Library</button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Add to Media Library</button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Schedule (when supported)</button>
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
