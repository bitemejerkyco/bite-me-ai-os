"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { demoWorkspace, loadLocal, STORAGE_KEYS, type CampaignPlan, type ContentDraft, type MediaAsset, type WorkspaceProfile } from "@/features/core/local-os";
import {
  loadCloudCampaigns,
  loadCloudDrafts,
  loadCloudMedia,
  loadCloudWorkspace,
} from "@/features/core/cloud-store";

export default function ExecutiveDashboard() {
  const [workspace, setWorkspace] = useState<WorkspaceProfile | null>(null);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignPlan[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);

  useEffect(() => {
    const refresh = async () => {
      try {
        const [cloudWorkspace, cloudDrafts, cloudCampaigns, cloudMedia] =
          await Promise.all([
            loadCloudWorkspace(),
            loadCloudDrafts(),
            loadCloudCampaigns(),
            loadCloudMedia(),
          ]);
        setWorkspace(
          cloudWorkspace ||
            loadLocal<WorkspaceProfile | null>(STORAGE_KEYS.workspace, null),
        );
        setDrafts(
          cloudDrafts.length ? cloudDrafts : loadLocal(STORAGE_KEYS.drafts, []),
        );
        setCampaigns(
          cloudCampaigns.length
            ? cloudCampaigns
            : loadLocal(STORAGE_KEYS.campaigns, []),
        );
        setMedia(
          cloudMedia.length ? cloudMedia : loadLocal(STORAGE_KEYS.media, []),
        );
      } catch {
        setWorkspace(loadLocal<WorkspaceProfile | null>(STORAGE_KEYS.workspace, null));
        setDrafts(loadLocal(STORAGE_KEYS.drafts, []));
        setCampaigns(loadLocal(STORAGE_KEYS.campaigns, []));
        setMedia(loadLocal(STORAGE_KEYS.media, []));
      }
    };
    void refresh();
    const listener = () => void refresh();
    window.addEventListener("bite-me-os-change", listener);
    return () => window.removeEventListener("bite-me-os-change", listener);
  }, []);

  const profile = workspace || demoWorkspace();
  const setupComplete = Boolean(workspace?.completedAt);
  const active = campaigns.filter((campaign) => campaign.status === "ACTIVE").length;
  const approved = drafts.filter((draft) => draft.status === "APPROVED").length;

  return (
    <div className="space-y-6">
      {!setupComplete ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 md:flex-row md:items-center md:justify-between">
          <div><h2 className="font-bold text-amber-100">Complete your business setup</h2><p className="mt-1 text-sm text-zinc-300">Add your brand, audience, voice, and industry compliance mode.</p></div>
          <Link href="/onboarding" className="rounded-lg bg-amber-400 px-4 py-2 text-center font-semibold text-black">Finish setup</Link>
        </section>
      ) : null}
      <section className="rounded-2xl border border-white/10 bg-[#111827] p-6">
        <p className="text-sm text-zinc-400">Workspace</p>
        <h2 className="mt-1 text-3xl font-black">{profile.businessName}</h2>
        <p className="mt-2 text-zinc-300">{profile.primaryGoal}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Active campaigns", active],
            ["Content drafts", drafts.length],
            ["Approved content", approved],
            ["Media assets", media.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/5 bg-black/25 p-4"><p className="text-sm text-zinc-400">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>
          ))}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["/studio", "Create content", "Generate a channel-ready, compliance-aware draft."],
          ["/media", "Upload media", "Organize logos, photos, videos, and brand assets."],
          ["/marketing", "Plan a campaign", "Turn an objective into an actionable campaign plan."],
        ].map(([href, title, copy]) => (
          <Link key={href} href={href} className="rounded-2xl border border-white/10 bg-[#111827] p-5 transition hover:-translate-y-0.5 hover:border-red-500/40"><h3 className="font-bold">{title} →</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{copy}</p></Link>
        ))}
      </section>
    </div>
  );
}
