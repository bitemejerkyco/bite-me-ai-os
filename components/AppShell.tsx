"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function AppShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#090d14] text-white md:flex-row">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="border-b border-red-500/20 bg-gradient-to-r from-red-700 via-red-650 to-red-800 px-5 py-7 md:px-9">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-100/80">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
