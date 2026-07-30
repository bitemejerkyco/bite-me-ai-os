"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ensureDemoData,
  loadLocal,
  resetDemoData,
  saveLocal,
  STORAGE_KEYS,
  type AccountMode,
} from "@/features/core/local-os";
import SignOutButton from "@/components/auth/SignOutButton";

export default function Sidebar() {
  const [mode, setMode] = useState<AccountMode>("SUPER_ADMIN");
  const pathname = usePathname();

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setMode(loadLocal(STORAGE_KEYS.accountMode, "SUPER_ADMIN")),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  const changeMode = (next: AccountMode) => {
    setMode(next);
    saveLocal(STORAGE_KEYS.accountMode, next);
    if (next === "DEMO") ensureDemoData();
    window.location.href = "/";
  };

  return (
    <aside className="w-full border-r border-white/80 bg-white/70 p-5 text-slate-800 shadow-[16px_0_50px_rgba(76,61,139,0.07)] backdrop-blur-2xl md:sticky md:top-0 md:min-h-screen md:w-72 md:self-start">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/postmotive-mark.png"
          alt=""
          width={48}
          height={48}
          priority
          className="h-12 w-12 rounded-2xl shadow-[0_12px_30px_rgba(104,87,245,0.22)]"
        />
        <span>
          <span className="pm-brand block text-2xl font-black tracking-tight">PostMotive</span>
          <span className="mt-0.5 block text-[11px] font-medium text-slate-500">AI marketing command center</span>
        </span>
      </Link>

      <nav className="mt-7 grid grid-cols-2 gap-2 md:block md:space-y-1">
        {[
          ["/", "Dashboard", "▦"],
          ["/onboarding", "Business Setup", "✓"],
          ["/marketing", "Marketing", "◆"],
          ["/studio", "AI Studio", "✦"],
          ["/content", "Content Library", "▤"],
          ["/calendar", "Calendar", "◫"],
          ["/knowledge", "Knowledge Base", "★"],
          ["/media", "Media Library", "▧"],
          ["/analytics", "Analytics", "↗"],
          ["/settings/integrations/tiktok", "Integrations", "⚙"],
        ].map(([href, label, icon]) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center gap-3 rounded-3xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-gradient-to-r from-violet-100 to-fuchsia-50 text-violet-800 shadow-sm"
                : "text-slate-600 hover:bg-white/80 hover:text-violet-700"
            }`}
          >
            <span className={`grid h-7 w-7 place-items-center rounded-2xl text-xs ${
              active
                ? "bg-white text-violet-600 shadow-sm"
                : "bg-slate-100 text-slate-500 group-hover:bg-violet-100 group-hover:text-violet-600"
            }`}>{icon}</span>
            {label}
          </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-3xl border border-white bg-white/75 p-4 shadow-[0_18px_45px_rgba(76,61,139,0.09)]">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Account mode</label>
        <select
          value={mode}
          onChange={(event) => changeMode(event.target.value as AccountMode)}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        >
          <option value="SUPER_ADMIN">Keith — Super Admin</option>
          <option value="DEMO">Demo Account</option>
        </select>
        <p className="mt-2 text-xs text-slate-500">
          {mode === "SUPER_ADMIN" ? "Billing exempt · Full access" : "Safe sample workspace"}
        </p>
        {mode === "DEMO" ? (
          <>
            <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              Demo sandbox active. Live customer data is protected.
            </p>
            <button
              onClick={() => {
                resetDemoData();
                window.location.href = "/";
              }}
              className="mt-2 w-full rounded-2xl border border-amber-200 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-50"
            >
              Reset demo data
            </button>
          </>
        ) : null}
        <SignOutButton />
      </div>
    </aside>
  );
}
