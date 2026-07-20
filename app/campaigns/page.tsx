"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { deleteCampaign, duplicateCampaign, listCampaigns } from "@/app/actions/campaignHistory";
import type { SavedCampaign } from "@/lib/campaign/types";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<SavedCampaign[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SavedCampaign | null>(null);
  const [message, setMessage] = useState("Loading campaigns…");

  async function refresh() {
    const result = await listCampaigns();
    if (result.success) { setCampaigns(result.campaigns); setMessage(result.campaigns.length ? "" : "No saved campaigns yet."); }
    else setMessage(result.error || "Unable to load campaigns.");
  }
  useEffect(() => { void refresh(); }, []);
  const filtered = useMemo(() => campaigns.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())), [campaigns, query]);

  return <div className="min-h-screen bg-[#090a0d] text-white lg:flex"><Sidebar/><main className="min-w-0 flex-1">
    <header className="page-header"><div><p className="eyebrow">Campaign History</p><h1 className="page-title">Every campaign, organized and reusable</h1></div></header>
    <div className="mx-auto max-w-[1500px] p-5 md:p-8"><div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="panel p-5"><input className="input" placeholder="Search campaigns" value={query} onChange={(e)=>setQuery(e.target.value)}/><div className="mt-4 space-y-3">{message&&<p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">{message}</p>}{filtered.map((item)=><button key={item.id} onClick={()=>setSelected(item)} className={`w-full rounded-2xl border p-4 text-left transition ${selected?.id===item.id?"border-red-500 bg-red-500/10":"border-white/10 bg-black/20 hover:border-white/20"}`}><div className="flex items-start justify-between gap-3"><p className="font-semibold">{item.title}</p><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase text-zinc-500">{item.status}</span></div><p className="mt-2 text-xs text-zinc-500">{new Date(item.updated_at).toLocaleString()}</p></button>)}</div></section>
      <section className="panel min-h-[700px] p-6">{selected?<><div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5"><div><p className="eyebrow text-zinc-500">Saved campaign</p><h2 className="mt-1 text-2xl font-bold">{selected.title}</h2></div><div className="flex gap-2"><button className="secondary-button" onClick={async()=>{const r=await duplicateCampaign(selected.id); setMessage(r.success?"Campaign duplicated.":r.error); await refresh();}}>Duplicate</button><button className="secondary-button text-red-300" onClick={async()=>{if(confirm("Delete this campaign?")){const r=await deleteCampaign(selected.id); if(r.success){setSelected(null); await refresh();}}}}>Delete</button></div></div><div className="mt-6 grid gap-4 md:grid-cols-2"><Info label="Brand" value={selected.brief.brandName}/><Info label="Goal" value={selected.brief.goal}/><Info label="Audience" value={selected.brief.audience}/><Info label="Platforms" value={selected.brief.platforms.join(", ")}/></div><div className="mt-6 space-y-4">{Object.entries(selected.output).map(([key,value])=><details key={key} className="rounded-2xl border border-white/10 bg-black/20 p-4"><summary className="cursor-pointer font-semibold capitalize">{key}</summary><pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{value}</pre></details>)}</div></>:<div className="grid min-h-[650px] place-items-center text-center"><div><p className="text-xl font-bold">Select a campaign</p><p className="mt-2 text-zinc-500">Review, duplicate, or remove saved work.</p></div></div>}</section>
    </div></div>
  </main></div>;
}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="field-label">{label}</p><p className="text-sm text-zinc-300">{value}</p></div>}
