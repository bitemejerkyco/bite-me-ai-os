"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { generateCampaign } from "@/app/actions/campaign";
import { listBrands } from "@/app/actions/brand";
import Sidebar from "@/components/Sidebar";
import type { CampaignPackage } from "@/lib/orchestrators/campaignOrchestrator";
import type { BrandProfile } from "@/lib/brand/types";

const platformOptions = ["TikTok", "Instagram", "Facebook", "YouTube Shorts", "Email"];
const tabs: Array<{ key: keyof CampaignPackage; label: string }> = [
  { key: "strategy", label: "Strategy" },
  { key: "social", label: "Social" },
  { key: "email", label: "Email" },
  { key: "video", label: "Video" },
  { key: "images", label: "Images" },
  { key: "calendar", label: "Calendar" },
];

const emptyCampaign: CampaignPackage = {
  strategy: "",
  social: "",
  email: "",
  video: "",
  images: "",
  calendar: "",
};

export default function Home() {
  const [brief, setBrief] = useState({
    brandName: "Bite Me Jerky",
    product: "Premium beef jerky paired with real dried fruit",
    goal: "Increase online sales and brand awareness",
    audience: "Adventure riders, travelers, outdoor enthusiasts, and high-protein snack buyers",
    platforms: ["TikTok", "Instagram", "Facebook"],
    campaignLength: "30 days",
    budget: "$5,000",
    tone: "Bold, adventurous, humorous, and direct",
  });
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [campaign, setCampaign] = useState<CampaignPackage>(emptyCampaign);
  const [activeTab, setActiveTab] = useState<keyof CampaignPackage>("strategy");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void listBrands().then((result) => {
      if (result.success) setBrands(result.brands);
    });
  }, []);

  const selectedBrand = useMemo(
    () => brands.find((item) => item.id === selectedBrandId),
    [brands, selectedBrandId]
  );

  const completedSections = useMemo(
    () => Object.values(campaign).filter(Boolean).length,
    [campaign]
  );

  function togglePlatform(platform: string) {
    setBrief((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCampaign(emptyCampaign);
    setActiveTab("strategy");
    setIsGenerating(true);

    const brandContext = selectedBrand
      ? `\n\nBRAND BRAIN CONTEXT:\nMission: ${selectedBrand.mission}\nTagline: ${selectedBrand.tagline}\nProducts: ${selectedBrand.products}\nCompetitors: ${selectedBrand.competitors}\nMarketing goals: ${selectedBrand.marketing_goals}\nWebsite: ${selectedBrand.website}`
      : "";

    const result = await generateCampaign({
      ...brief,
      brandName: selectedBrand?.name || brief.brandName,
      audience: selectedBrand?.target_audience || brief.audience,
      tone: selectedBrand?.brand_voice || brief.tone,
      product: `${brief.product}${brandContext}`,
    });
    if (result.success) setCampaign(result.campaign);
    else setError(result.error);
    setIsGenerating(false);
  }

  async function copySection() {
    const content = campaign[activeTab];
    if (content) await navigator.clipboard.writeText(content);
  }

  function exportCampaign() {
    const content = tabs
      .map(({ key, label }) => `# ${label}\n\n${campaign[key] || "Not generated"}`)
      .join("\n\n---\n\n");
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${brief.brandName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-campaign.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#0b0c0f] text-white lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="border-b border-white/10 bg-[#0b0c0f]/90 px-5 py-5 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-500">Campaign Studio</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Build a complete campaign</h1>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-zinc-400">{completedSections}/6 sections ready</div>
              <div className="grid size-10 place-items-center rounded-full bg-zinc-800 text-sm font-bold">KH</div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-5 md:p-8">
          <section className="mb-6 overflow-hidden rounded-3xl border border-red-500/20 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,.22),transparent_38%),linear-gradient(135deg,#17191f,#0e0f12)] p-6 md:p-8">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">Six-agent campaign engine</div>
              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">One brief. A full marketing campaign.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">LaunchAI turns your objective into strategy, social content, emails, short-form video concepts, image prompts, and a coordinated calendar.</p>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
            <form onSubmit={handleSubmit} className="h-fit rounded-3xl border border-white/10 bg-[#111318] p-5 shadow-2xl shadow-black/20 md:p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Campaign brief</p>
                  <h3 className="mt-1 text-xl font-bold">Set the direction</h3>
                </div>
                <span className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-xs text-zinc-500">Step 1</span>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Saved Brand Brain</span>
                  <select
                    value={selectedBrandId}
                    onChange={(event) => {
                      const id = event.target.value;
                      setSelectedBrandId(id);
                      const item = brands.find((candidate) => candidate.id === id);
                      if (item) setBrief((current) => ({
                        ...current,
                        brandName: item.name,
                        audience: item.target_audience || current.audience,
                        tone: item.brand_voice || current.tone,
                      }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-[#0d0e11] px-4 py-3 text-sm outline-none focus:border-red-500/70"
                  >
                    <option value="">Use manual campaign details</option>
                    {brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>

                {[
                  ["Brand name", "brandName"],
                  ["Product or promotion", "product"],
                  ["Campaign goal", "goal"],
                  ["Target audience", "audience"],
                  ["Budget", "budget"],
                  ["Brand tone", "tone"],
                ].map(([label, key]) => (
                  <label key={key} className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
                    <input
                      value={brief[key as keyof typeof brief] as string}
                      onChange={(event) => setBrief({ ...brief, [key]: event.target.value })}
                      required={key !== "budget"}
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-red-500/70 focus:ring-4 focus:ring-red-500/10"
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Campaign length</span>
                  <select value={brief.campaignLength} onChange={(event) => setBrief({ ...brief, campaignLength: event.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0d0e11] px-4 py-3 text-sm outline-none focus:border-red-500/70">
                    <option>7 days</option><option>14 days</option><option>30 days</option><option>60 days</option><option>90 days</option>
                  </select>
                </label>

                <div>
                  <span className="mb-3 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Platforms</span>
                  <div className="flex flex-wrap gap-2">
                    {platformOptions.map((platform) => {
                      const selected = brief.platforms.includes(platform);
                      return <button key={platform} type="button" onClick={() => togglePlatform(platform)} className={`rounded-full border px-3 py-2 text-xs font-medium transition ${selected ? "border-red-500 bg-red-500/15 text-red-200" : "border-white/10 bg-white/[0.03] text-zinc-500 hover:text-white"}`}>{platform}</button>;
                    })}
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isGenerating} className="mt-6 w-full rounded-xl bg-red-600 px-5 py-4 font-bold shadow-lg shadow-red-950/40 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60">
                {isGenerating ? "Agents are building your campaign..." : "Generate complete campaign"}
              </button>
            </form>

            <section className="min-w-0 rounded-3xl border border-white/10 bg-[#111318] shadow-2xl shadow-black/20">
              <div className="border-b border-white/10 p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Campaign workspace</p>
                    <h3 className="mt-1 text-xl font-bold">Generated deliverables</h3>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={copySection} disabled={!campaign[activeTab]} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/[0.05] disabled:opacity-30">Copy section</button>
                    <button type="button" onClick={exportCampaign} disabled={!completedSections} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/[0.05] disabled:opacity-30">Export all</button>
                  </div>
                </div>

                <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                  {tabs.map(({ key, label }) => (
                    <button key={key} type="button" onClick={() => setActiveTab(key)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === key ? "bg-white text-black" : "bg-white/[0.04] text-zinc-500 hover:text-white"}`}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="min-h-[650px] p-5 md:p-6">
                {error ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm leading-6 text-red-200">{error}</div>
                ) : isGenerating ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5">
                      <p className="font-semibold">Campaign engine is running</p>
                      <p className="mt-1 text-sm text-zinc-500">Strategy runs first, then five specialist agents work in parallel.</p>
                    </div>
                    {tabs.map(({ label }, index) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"><span className={`grid size-9 place-items-center rounded-full text-xs font-bold ${index === 0 ? "bg-red-600" : "bg-white/[0.06] text-zinc-500"}`}>{index + 1}</span><div><p className="text-sm font-semibold">{label} agent</p><p className="text-xs text-zinc-600">{index === 0 ? "Creating campaign foundation" : "Queued for production"}</p></div></div>)}
                  </div>
                ) : campaign[activeTab] ? (
                  <textarea value={campaign[activeTab]} onChange={(event) => setCampaign({ ...campaign, [activeTab]: event.target.value })} className="min-h-[610px] w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-zinc-200 outline-none focus:border-red-500/50" />
                ) : (
                  <div className="grid min-h-[610px] place-items-center rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
                    <div className="max-w-md"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/[0.04] text-lg font-black text-zinc-600">AI</div><h4 className="mt-5 text-xl font-bold">Your campaign workspace is ready</h4><p className="mt-2 text-sm leading-6 text-zinc-500">Complete the campaign brief and LaunchAI will populate all six deliverables here.</p></div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
