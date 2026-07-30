"use client";

import { useEffect, useState } from "react";
import { loadLocal, saveLocal, STORAGE_KEYS, type CampaignPlan } from "@/features/core/local-os";
import {
  loadCloudCampaigns,
  saveCloudCampaign,
} from "@/features/core/cloud-store";

export default function MarketingWorkspace() {
  const [campaigns, setCampaigns] = useState<CampaignPlan[]>([]);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("Generate sales");
  const [channel, setChannel] = useState("Email");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [budget, setBudget] = useState("500");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadCloudCampaigns()
        .then((cloud) =>
          setCampaigns(
            cloud.length ? cloud : loadLocal(STORAGE_KEYS.campaigns, []),
          ),
        )
        .catch(() => setCampaigns(loadLocal(STORAGE_KEYS.campaigns, [])));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    setWorking(true);
    setMessage("");
    const campaign: CampaignPlan = {
      id: crypto.randomUUID(), name: name.trim(), objective, channel,
      status: "PLANNED", startDate, budget: Math.max(0, Number(budget) || 0),
    };
    try {
      await saveCloudCampaign(campaign);
      const next = [campaign, ...campaigns];
      setCampaigns(next);
      saveLocal(STORAGE_KEYS.campaigns, next);
      setName("");
      setMessage("Campaign saved securely.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save campaign.");
    } finally {
      setWorking(false);
    }
  };

  const changeStatus = async (id: string, status: CampaignPlan["status"]) => {
    const next = campaigns.map((campaign) => campaign.id === id ? { ...campaign, status } : campaign);
    const changed = next.find((campaign) => campaign.id === id);
    if (!changed) return;
    try {
      await saveCloudCampaign(changed);
      setCampaigns(next);
      saveLocal(STORAGE_KEYS.campaigns, next);
      setMessage("Campaign status saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to update campaign.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
        <h2 className="text-xl font-bold">Create campaign plan</h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm text-zinc-300">Campaign name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer DTC push" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" /></label>
          <label className="block text-sm text-zinc-300">Objective<select value={objective} onChange={(e) => setObjective(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"><option>Generate sales</option><option>Build awareness</option><option>Generate leads</option><option>Promote an event</option></select></label>
          <label className="block text-sm text-zinc-300">Primary channel<select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"><option>Email</option><option>Instagram</option><option>TikTok</option><option>Facebook</option><option>Website</option><option>Amazon</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-zinc-300">Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" /></label>
            <label className="block text-sm text-zinc-300">Budget<input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" /></label>
          </div>
          <button disabled={working} onClick={() => void add()} className="w-full rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-500 disabled:opacity-60">
            {working ? "Saving…" : "Add campaign"}
          </button>
          {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
        <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Campaign command center</h2><p className="text-sm text-zinc-400">{campaigns.length} campaign plans</p></div></div>
        {campaigns.length === 0 ? <p className="mt-6 rounded-xl bg-black/20 p-8 text-center text-zinc-400">Create your first campaign plan.</p> : (
          <div className="mt-5 space-y-3">
            {campaigns.map((campaign) => (
              <article key={campaign.id} className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div><h3 className="font-semibold">{campaign.name}</h3><p className="mt-1 text-sm text-zinc-400">{campaign.channel} · {campaign.objective} · Starts {campaign.startDate} · ${campaign.budget.toLocaleString()}</p></div>
                <select value={campaign.status} onChange={(e) => void changeStatus(campaign.id, e.target.value as CampaignPlan["status"])} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"><option value="PLANNED">Planned</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option></select>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
