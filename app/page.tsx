"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { generateCampaign } from "@/app/actions/campaign";
import { listBrands } from "@/app/actions/brand";
import { saveCampaign } from "@/app/actions/campaignHistory";
import Sidebar from "@/components/Sidebar";
import AgentProgress, { type AgentProgressItem } from "@/components/campaign/AgentProgress";
import type { CampaignPackage } from "@/lib/orchestrators/campaignOrchestrator";
import type { CampaignBrief } from "@/lib/agents/campaignStrategist";
import type { BrandProfile } from "@/lib/brand/types";

const platformOptions = ["TikTok", "Instagram", "Facebook", "YouTube Shorts", "Email", "LinkedIn"];
const tabs: Array<{ key: keyof CampaignPackage; label: string }> = [
  { key: "research", label: "Research" }, { key: "strategy", label: "Strategy" },
  { key: "social", label: "Social" }, { key: "email", label: "Email" },
  { key: "video", label: "Video" }, { key: "images", label: "Creative" },
  { key: "seo", label: "SEO" }, { key: "calendar", label: "Calendar" },
];

const emptyCampaign: CampaignPackage = { research: "", strategy: "", social: "", email: "", video: "", images: "", seo: "", calendar: "" };
const baseAgents: AgentProgressItem[] = [
  { key: "research", name: "Research Analyst", role: "Audience and positioning", state: "queued" },
  { key: "strategy", name: "Marketing Director", role: "Campaign direction", state: "queued" },
  { key: "social", name: "Social Manager", role: "Platform content", state: "queued" },
  { key: "email", name: "Email Specialist", role: "Conversion sequence", state: "queued" },
  { key: "video", name: "Video Producer", role: "Short-form concepts", state: "queued" },
  { key: "images", name: "Creative Director", role: "Visual concepts", state: "queued" },
  { key: "seo", name: "SEO Specialist", role: "Organic acquisition", state: "queued" },
  { key: "calendar", name: "Content Planner", role: "Execution schedule", state: "queued" },
];

export default function Home() {
  const [brief, setBrief] = useState<CampaignBrief>({
    brandName: "Bite Me Jerky", product: "Premium beef jerky paired with real dried fruit",
    goal: "Increase online sales and brand awareness",
    audience: "Adventure riders, travelers, outdoor enthusiasts, and high-protein snack buyers",
    platforms: ["TikTok", "Instagram", "Facebook"], campaignLength: "30 days", budget: "$5,000",
    tone: "Bold, adventurous, humorous, and direct",
  });
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [campaign, setCampaign] = useState<CampaignPackage>(emptyCampaign);
  const [activeTab, setActiveTab] = useState<keyof CampaignPackage>("research");
  const [agents, setAgents] = useState(baseAgents);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { void listBrands().then((result) => result.success && setBrands(result.brands)); }, []);
  useEffect(() => () => { if (progressTimer.current) clearInterval(progressTimer.current); }, []);

  const selectedBrand = useMemo(() => brands.find((item) => item.id === selectedBrandId), [brands, selectedBrandId]);
  const completedSections = useMemo(() => Object.values(campaign).filter(Boolean).length, [campaign]);

  function togglePlatform(platform: string) {
    setBrief((current) => ({ ...current, platforms: current.platforms.includes(platform) ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform] }));
  }

  function beginProgress() {
    let index = 0;
    setAgents(baseAgents.map((item, itemIndex) => ({ ...item, state: itemIndex === 0 ? "working" : "queued" })));
    progressTimer.current = setInterval(() => {
      index = Math.min(index + 1, baseAgents.length - 1);
      setAgents(baseAgents.map((item, itemIndex) => ({ ...item, state: itemIndex < index ? "complete" : itemIndex === index ? "working" : "queued" })));
    }, 4500);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setCampaign(emptyCampaign); setActiveTab("research"); setIsGenerating(true); beginProgress();
    const brandContext = selectedBrand ? `\n\nBRAND BRAIN CONTEXT:\nMission: ${selectedBrand.mission}\nTagline: ${selectedBrand.tagline}\nProducts: ${selectedBrand.products}\nCompetitors: ${selectedBrand.competitors}\nMarketing goals: ${selectedBrand.marketing_goals}\nWebsite: ${selectedBrand.website}` : "";
    const finalBrief: CampaignBrief = { ...brief, brandName: selectedBrand?.name || brief.brandName, audience: selectedBrand?.target_audience || brief.audience, tone: selectedBrand?.brand_voice || brief.tone, product: `${brief.product}${brandContext}` };
    const result = await generateCampaign(finalBrief);
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (result.success) { setCampaign(result.campaign); setAgents(baseAgents.map((item) => ({ ...item, state: "complete" }))); setMessage("Campaign complete. Review, edit, export, or save it."); }
    else { setAgents(baseAgents); setMessage(result.error); }
    setIsGenerating(false);
  }

  async function handleSave() {
    if (!campaign.strategy) return setMessage("Generate a campaign before saving.");
    const result = await saveCampaign({ title: `${brief.brandName} — ${brief.goal}`, brandId: selectedBrandId || undefined, brief, output: campaign });
    setMessage(result.success ? "Campaign saved to Campaign History." : result.error);
  }

  async function copySection() { const content = campaign[activeTab]; if (content) { await navigator.clipboard.writeText(content); setMessage(`${tabs.find((tab) => tab.key === activeTab)?.label} copied.`); } }
  function exportCampaign() {
    const content = tabs.map(({ key, label }) => `# ${label}\n\n${campaign[key] || "Not generated"}`).join("\n\n---\n\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${brief.brandName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-campaign.md`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#090a0d] text-white lg:flex"><Sidebar /><main className="min-w-0 flex-1">
      <header className="border-b border-white/10 bg-[#090a0d]/90 px-5 py-5 backdrop-blur md:px-8"><div className="mx-auto flex max-w-[1550px] items-center justify-between gap-4"><div><p className="eyebrow">Campaign Studio</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">Deploy your AI marketing team</h1></div><div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-zinc-400">{completedSections}/8 deliverables ready</div></div></header>
      <div className="mx-auto max-w-[1550px] p-5 md:p-8">
        <section className="hero-panel"><div className="max-w-4xl"><span className="pill">Eight specialized AI employees</span><h2 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">One brief. A coordinated marketing department.</h2><p className="mt-4 max-w-3xl text-zinc-400">Research, strategy, social, email, video, creative direction, SEO, and execution planning—built together and grounded in your Brand Brain.</p></div></section>
        <div className="mt-6"><AgentProgress agents={agents} /></div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <form onSubmit={handleSubmit} className="panel h-fit p-5 md:p-6"><div className="mb-6"><p className="eyebrow text-zinc-500">Campaign brief</p><h3 className="mt-1 text-xl font-bold">Set the direction</h3></div><div className="space-y-4">
            <Field label="Saved Brand Brain"><select value={selectedBrandId} onChange={(e) => { const id=e.target.value; setSelectedBrandId(id); const item=brands.find((b)=>b.id===id); if(item) setBrief((c)=>({...c,brandName:item.name,audience:item.target_audience||c.audience,tone:item.brand_voice||c.tone})); }} className="input"><option value="">Manual details</option>{brands.map((b)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            {([['Brand name','brandName'],['Product or promotion','product'],['Campaign goal','goal'],['Target audience','audience'],['Budget','budget'],['Brand tone','tone']] as const).map(([label,key])=><Field key={key} label={label}><input className="input" value={String(brief[key]||"")} onChange={(e)=>setBrief({...brief,[key]:e.target.value})} required={key!=="budget"}/></Field>)}
            <Field label="Campaign length"><select className="input" value={brief.campaignLength} onChange={(e)=>setBrief({...brief,campaignLength:e.target.value})}>{["7 days","14 days","30 days","60 days","90 days"].map((x)=><option key={x}>{x}</option>)}</select></Field>
            <div><span className="field-label">Platforms</span><div className="flex flex-wrap gap-2">{platformOptions.map((p)=><button key={p} type="button" onClick={()=>togglePlatform(p)} className={`chip ${brief.platforms.includes(p)?"chip-active":""}`}>{p}</button>)}</div></div>
            <button disabled={isGenerating} className="w-full rounded-xl bg-red-600 px-5 py-3.5 text-sm font-black transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-50">{isGenerating?"AI team is working…":"Generate complete campaign"}</button>
          </div></form>
          <section className="panel min-h-[760px] overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 md:p-5"><div><p className="eyebrow text-zinc-500">Campaign workspace</p><h3 className="mt-1 text-xl font-bold">Review and activate</h3></div><div className="flex gap-2"><button onClick={copySection} className="secondary-button">Copy</button><button onClick={exportCampaign} className="secondary-button">Export</button><button onClick={handleSave} className="primary-button">Save</button></div></div>
            <div className="flex overflow-x-auto border-b border-white/10 px-3">{tabs.map((tab)=><button key={tab.key} onClick={()=>setActiveTab(tab.key)} className={`tab ${activeTab===tab.key?"tab-active":""}`}>{tab.label}</button>)}</div>
            {message&&<div className="mx-5 mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">{message}</div>}
            <div className="p-5 md:p-7">{campaign[activeTab]?<textarea value={campaign[activeTab]} onChange={(e)=>setCampaign({...campaign,[activeTab]:e.target.value})} className="min-h-[590px] w-full resize-y rounded-2xl border border-white/10 bg-black/20 p-5 font-mono text-sm leading-7 text-zinc-200 outline-none focus:border-red-500/50"/>:<div className="grid min-h-[590px] place-items-center rounded-2xl border border-dashed border-white/10 bg-black/10 text-center"><div><p className="text-lg font-bold">Your AI team is ready</p><p className="mt-2 text-sm text-zinc-500">Complete the brief and launch all eight specialists.</p></div></div>}</div>
          </section>
        </div>
      </div>
    </main></div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="field-label">{label}</span>{children}</label>; }
