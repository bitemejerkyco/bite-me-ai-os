"use client";

import Link from "next/link";
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
    <aside className="w-full border-r border-white/5 bg-[#111827] p-5 text-white md:min-h-screen md:w-72">
      <Link href="/" className="block text-2xl font-black text-red-500">PostMotive</Link>
      <p className="mt-1 text-xs text-zinc-400">AI marketing command center</p>

      <nav className="mt-7 grid grid-cols-2 gap-2 md:block md:space-y-1">
        {[
          ["/", "Dashboard", "▦"],
          ["/onboarding", "Business Setup", "✓"],
          ["/marketing", "Marketing", "◆"],
          ["/studio", "AI Studio", "✦"],
          ["/calendar", "Calendar", "◫"],
          ["/knowledge", "Knowledge Base", "★"],
          ["/media", "Media Library", "▧"],
          ["/analytics", "Analytics", "↗"],
          ["/settings/integrations/amazon-ads", "Integrations", "⚙"],
        ].map(([href, label, icon]) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
          >
            <span className="w-5 text-center text-red-400">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Account mode</label>
        <select
          value={mode}
          onChange={(event) => changeMode(event.target.value as AccountMode)}
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        >
          <option value="SUPER_ADMIN">Keith — Super Admin</option>
          <option value="DEMO">Demo Account</option>
        </select>
        <p className="mt-2 text-xs text-zinc-500">
          {mode === "SUPER_ADMIN" ? "Billing exempt · Full access" : "Safe sample workspace"}
        </p>
        {mode === "DEMO" ? (
          <>
            <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
              Demo sandbox active. Live customer data is protected.
            </p>
            <button
              onClick={() => {
                resetDemoData();
                window.location.href = "/";
              }}
              className="mt-2 w-full rounded-lg border border-amber-500/30 px-3 py-2 text-left text-xs text-amber-200 hover:bg-amber-500/10"
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
