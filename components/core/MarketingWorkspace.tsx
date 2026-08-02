"use client";

import { useEffect, useState } from "react";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import { SUCCESS_MESSAGES } from "@/features/help/success-messages";
import { loadLocal, saveLocal, STORAGE_KEYS, workspaceStorageKey, type CampaignPlan, type WorkspaceProfile } from "@/features/core/local-os";
import {
  loadCloudCampaigns,
  loadCloudWorkspace,
  saveCloudCampaign,
} from "@/features/core/cloud-store";

export default function MarketingWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceProfile | null>(null);
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
      void Promise.all([loadCloudWorkspace(), loadCloudCampaigns()])
        .then(([cloudWorkspace, cloud]) => {
          const workspaceId = cloudWorkspace?.id || null;
          setWorkspace(cloudWorkspace);
          if (cloud.length) {
            setCampaigns(cloud);
            return;
          }
          setCampaigns(workspaceId ? loadLocal(workspaceStorageKey(STORAGE_KEYS.campaigns, workspaceId), []) : []);
        })
        .catch(() => {
          setCampaigns([]);
        });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const add = async (continueToStudio = true) => {
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
      if (workspace?.id) {
        saveLocal(workspaceStorageKey(STORAGE_KEYS.campaigns, workspace.id), next);
      }
      setName("");
      const success = SUCCESS_MESSAGES.campaignCreated();
      setMessage(`${success.title} ${success.detail}`);
      if (continueToStudio) {
        const params = new URLSearchParams({
          campaign: campaign.name,
          objective: campaign.objective,
          channel: campaign.channel,
        });
        window.location.assign(`/studio?${params.toString()}`);
      }
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
      if (workspace?.id) {
        saveLocal(workspaceStorageKey(STORAGE_KEYS.campaigns, workspace.id), next);
      }
      setMessage("Campaign updated successfully. Recommended next step: review whether the current status still matches the active content plan.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to update campaign.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <section data-help="campaign-create-form" className="rounded-3xl border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-xl font-bold">Create campaign plan</h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm text-slate-700">Campaign name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer DTC push" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" /></label>
          <label className="block text-sm text-slate-700">Objective<select value={objective} onChange={(e) => setObjective(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"><option>Generate sales</option><option>Build awareness</option><option>Generate leads</option><option>Promote an event</option></select></label>
          <label className="block text-sm text-slate-700">Primary channel<select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"><option>Email</option><option>Instagram</option><option>TikTok</option><option>Facebook</option><option>Website</option><option>Amazon</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-slate-700">Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" /></label>
            <label className="block text-sm text-slate-700">Budget<input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" /></label>
          </div>
          <button disabled={working} onClick={() => void add()} className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-60">
            {working ? "Saving…" : "Save & create campaign content →"}
          </button>
          <button disabled={working} onClick={() => void add(false)} className="w-full rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-violet-50 disabled:opacity-60">
            Save plan only
          </button>
          {message ? <p className="text-sm text-slate-700">{message}</p> : null}
        </div>
      </section>
      <section data-help="campaign-list" className="rounded-3xl border border-slate-200/80 bg-white/80 p-5">
        <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Campaign command center</h2><p className="text-sm text-slate-500">{campaigns.length} campaign plans</p></div></div>
        {campaigns.length === 0 ? <div className="mt-6"><GuidedEmptyState title="No campaigns yet." description="Create your first AI-powered campaign to organize strategy, content, approval, and scheduling." estimatedTime="2 minutes" primaryAction={{ label: "Create Campaign", href: "/marketing/campaigns" }} secondaryAction={{ label: "Learn how campaigns work", href: "/help" }} /></div> : (
          <div className="mt-5 space-y-3">
            {campaigns.map((campaign) => (
              <article key={campaign.id} className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div><h3 className="font-semibold">{campaign.name}</h3><p className="mt-1 text-sm text-slate-500">{campaign.channel} · {campaign.objective} · Starts {campaign.startDate} · ${campaign.budget.toLocaleString()}</p></div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const params = new URLSearchParams({
                        campaign: campaign.name,
                        objective: campaign.objective,
                        channel: campaign.channel,
                      });
                      window.location.assign(`/studio?${params.toString()}`);
                    }}
                    className="rounded-xl border border-violet-200 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
                  >
                    Create content
                  </button>
                  <select value={campaign.status} onChange={(e) => void changeStatus(campaign.id, e.target.value as CampaignPlan["status"])} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="PLANNED">Planned</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option></select>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
