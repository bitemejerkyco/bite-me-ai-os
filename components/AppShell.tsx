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
    <div className="pm-shell flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="pm-page-header px-5 py-8 md:px-10 md:py-10">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-900 md:text-5xl">{title}</h1>
          </div>
        </header>
        <main className="pm-content mx-auto max-w-7xl p-4 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
