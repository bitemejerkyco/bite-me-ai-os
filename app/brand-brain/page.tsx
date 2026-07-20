"use client";

import { FormEvent, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { deleteBrand, listBrands, saveBrand } from "@/app/actions/brand";
import { emptyBrand, type BrandProfile } from "@/lib/brand/types";

const fields: Array<{ key: keyof BrandProfile; label: string; placeholder: string; area?: boolean }> = [
  { key: "name", label: "Brand name", placeholder: "Bite Me Jerky" },
  { key: "website", label: "Website", placeholder: "https://welikejerky.com" },
  { key: "industry", label: "Industry", placeholder: "Food & Beverage" },
  { key: "tagline", label: "Tagline", placeholder: "Just put it in your mouth!" },
  { key: "mission", label: "Mission", placeholder: "What does the brand exist to do?", area: true },
  { key: "brand_voice", label: "Voice and tone", placeholder: "Bold, humorous, adventurous, direct", area: true },
  { key: "target_audience", label: "Target audiences", placeholder: "Adventure riders, travelers, outdoor enthusiasts", area: true },
  { key: "products", label: "Products and offers", placeholder: "Sweet & Spicy Mango; Hickory Apple; Teriyaki Pineapple", area: true },
  { key: "competitors", label: "Competitors", placeholder: "List direct and aspirational competitors", area: true },
  { key: "marketing_goals", label: "Marketing goals", placeholder: "Increase DTC sales, Amazon conversion, and wholesale accounts", area: true },
  { key: "logo_url", label: "Logo URL", placeholder: "https://..." },
];

export default function BrandBrainPage() {
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [brand, setBrand] = useState<BrandProfile>(emptyBrand);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    const result = await listBrands();
    if (result.success) setBrands(result.brands);
    else setMessage(result.error ?? "Unable to load brands.");
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const result = await saveBrand(brand);
    if (result.success && result.brand) {
      setBrand(result.brand);
      setMessage("Brand profile saved. Campaign Studio can now use this context.");
      await refresh();
    } else setMessage(result.error ?? "Unable to save brand.");
    setSaving(false);
  }

  async function remove() {
    if (!brand.id || !window.confirm(`Delete ${brand.name}?`)) return;
    const result = await deleteBrand(brand.id);
    if (result.success) { setBrand(emptyBrand); await refresh(); }
    else setMessage(result.error ?? "Unable to delete brand.");
  }

  return (
    <div className="min-h-screen bg-[#0b0c0f] text-white lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="border-b border-white/10 px-5 py-5 md:px-8"><div className="mx-auto max-w-[1500px]"><p className="text-xs font-bold uppercase tracking-[0.28em] text-red-500">Brand Brain</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">Teach LaunchAI how your brand thinks</h1></div></header>
        <div className="mx-auto grid max-w-[1500px] gap-6 p-5 md:p-8 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-[#111318] p-5">
            <div className="flex items-center justify-between"><h2 className="font-bold">Saved brands</h2><button onClick={() => setBrand(emptyBrand)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold">New</button></div>
            <div className="mt-4 space-y-2">
              {loading ? <p className="text-sm text-zinc-500">Loading brands...</p> : brands.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No brands yet. Create the first Brand Brain profile.</p> : brands.map((item) => <button key={item.id} onClick={() => setBrand(item)} className={`w-full rounded-xl border p-3 text-left ${brand.id === item.id ? "border-red-500 bg-red-500/10" : "border-white/10 bg-black/20"}`}><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{item.industry || "Industry not set"}</p></button>)}
            </div>
          </aside>

          <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-[#111318] p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Brand profile</p><h2 className="mt-1 text-2xl font-bold">{brand.id ? `Edit ${brand.name}` : "Create a brand"}</h2></div><div className="flex gap-2">{brand.id && <button type="button" onClick={remove} className="rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-300">Delete</button>}<button disabled={saving} className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving..." : "Save Brand"}</button></div></div>
            {message && <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">{message}</div>}
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {fields.map((field) => <label key={field.key} className={field.area ? "md:col-span-2" : ""}><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">{field.label}</span>{field.area ? <textarea rows={4} value={String(brand[field.key] ?? "")} onChange={(e) => setBrand({ ...brand, [field.key]: e.target.value })} placeholder={field.placeholder} className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none focus:border-red-500/70" /> : <input value={String(brand[field.key] ?? "")} onChange={(e) => setBrand({ ...brand, [field.key]: e.target.value })} placeholder={field.placeholder} required={field.key === "name"} className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none focus:border-red-500/70" />}</label>)}
              <label><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Primary color</span><div className="flex gap-3"><input type="color" value={brand.primary_color} onChange={(e) => setBrand({ ...brand, primary_color: e.target.value })} className="h-12 w-16 rounded-lg border border-white/10 bg-transparent" /><input value={brand.primary_color} onChange={(e) => setBrand({ ...brand, primary_color: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/25 px-4" /></div></label>
              <label><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Secondary color</span><div className="flex gap-3"><input type="color" value={brand.secondary_color} onChange={(e) => setBrand({ ...brand, secondary_color: e.target.value })} className="h-12 w-16 rounded-lg border border-white/10 bg-transparent" /><input value={brand.secondary_color} onChange={(e) => setBrand({ ...brand, secondary_color: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/25 px-4" /></div></label>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
