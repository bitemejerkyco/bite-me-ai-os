"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  ["Campaign Studio", "CS", "/"],
  ["Campaigns", "CA", "/campaigns"],
  ["Brand Brain", "BB", "/brand-brain"],
  ["Asset Library", "AL", "/assets"],
  ["Agents", "AI", "/agents"],
  ["Analytics", "AN", "/analytics"],
  ["Settings", "SE", "/settings"],
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-white/10 bg-[#08090b] p-5 text-white lg:flex lg:flex-col">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-red-600 text-sm font-black shadow-lg shadow-red-950/50">LA</div>
          <div><p className="text-lg font-bold tracking-tight">LaunchAI</p><p className="text-xs text-zinc-500">Marketing operating system</p></div>
        </div>
      </div>

      <nav className="mt-8 space-y-1.5">
        {navigation.map(([label, icon, href]) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={label} href={href} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${active ? "bg-white text-black shadow-lg shadow-black/20" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"}`}>
              <span className={`grid size-8 place-items-center rounded-lg text-[10px] font-bold ${active ? "bg-black text-white" : "bg-white/[0.05] text-zinc-400"}`}>{icon}</span>
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4">
        <p className="text-sm font-semibold">LaunchAI v0.3</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Brand Brain keeps every campaign aligned with your business.</p>
      </div>
    </aside>
  );
}
