import AppShell from "@/components/AppShell";
import Link from "next/link";
import { DemoBadge, EmptyPanel } from "@/components/creators/CreatorUi";
import { CREATOR_EMPTY_STATES } from "@/features/creators/empty-states";
import { loadCreatorHubData } from "@/features/creators/repository";
import { CREATOR_PIPELINE_STAGES } from "@/features/creators/types";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export default async function CreatorPipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireWorkspaceContext();
  const data = await loadCreatorHubData({ workspaceId: context.workspaceId, userId: context.userId });
  const query = await searchParams;

  const stage = String(query.stage || "ALL");
  const campaign = String(query.campaign || "ALL");
  const keyword = String(query.search || "").toLowerCase();

  const records = data.pipeline.filter((item) => {
    if (stage !== "ALL" && item.stage !== stage) return false;
    if (campaign !== "ALL" && item.campaignId !== campaign) return false;
    if (!keyword) return true;
    const creator = data.creators.find((value) => value.id === item.creatorId);
    return (
      creator?.displayName.toLowerCase().includes(keyword)
      || creator?.handle.toLowerCase().includes(keyword)
      || String(item.notes || "").toLowerCase().includes(keyword)
    );
  });

  const grouped = CREATOR_PIPELINE_STAGES.map((pipelineStage) => ({
    stage: pipelineStage,
    records: records.filter((item) => item.stage === pipelineStage),
  })).filter((group) => group.records.length > 0);

  return (
    <AppShell title="Creator Pipeline" eyebrow="CRM workflow across creator relationship stages">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-700">Kanban and list view for discover, outreach, negotiation, active work, and long-term ambassador paths.</p>
          <DemoBadge />
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-4" method="get">
          <label className="text-sm text-slate-700">Stage
            <select name="stage" defaultValue={stage} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              <option value="ALL">All</option>
              {CREATOR_PIPELINE_STAGES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Campaign
            <select name="campaign" defaultValue={campaign} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
              <option value="ALL">All</option>
              {data.campaigns.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Search creators
            <input name="search" defaultValue={String(query.search || "")} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" placeholder="Name or handle" />
          </label>
          <div className="self-end flex gap-2">
            <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Filter</button>
            <Link href="/creators/pipeline" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Clear</Link>
          </div>
        </form>
      </section>

      {grouped.length === 0 ? (
        <EmptyPanel title={CREATOR_EMPTY_STATES.pipeline.title} description={CREATOR_EMPTY_STATES.pipeline.description} />
      ) : (
        <section className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-3">
            {grouped.map((group) => (
              <article key={group.stage} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">{group.stage}</p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{group.records.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {group.records.map((record) => {
                    const creator = data.creators.find((item) => item.id === record.creatorId);
                    return (
                      <div key={record.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        <p className="text-sm font-semibold text-slate-900">{creator?.displayName || record.creatorId}</p>
                        <p className="mt-1 text-xs text-slate-500">{creator?.handle || ""}</p>
                        <p className="mt-1 text-xs text-slate-600">Next action: {record.nextAction || "Not set"}</p>
                        <p className="mt-1 text-xs text-slate-600">Follow-up: {record.nextActionAt ? new Date(record.nextActionAt).toLocaleString() : "Not set"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link href={`/creators/${record.creatorId}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">Open profile</Link>
                          <Link href="/creators/campaigns" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">Attach campaign</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>

          <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
            <p className="text-sm text-slate-700">Pipeline transitions are persisted and logged in creator activity events when moved via Creator Hub actions.</p>
          </section>
        </section>
      )}
    </AppShell>
  );
}
