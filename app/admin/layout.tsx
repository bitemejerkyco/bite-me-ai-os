import Link from "next/link";
import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import { requireSuperAdmin } from "@/lib/auth/server";

const adminLinks = [
  ["/admin", "Overview"],
  ["/admin/accounts", "Accounts"],
  ["/admin/users", "Users"],
  ["/admin/plans", "Plans & Pricing"],
  ["/admin/features", "Features"],
  ["/admin/integrations", "Integrations"],
  ["/admin/costs", "AI Costs"],
  ["/admin/system", "System Health"],
  ["/admin/settings", "Settings"],
  ["/admin/audit", "Audit Log"],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await requireSuperAdmin();

  return (
    <div className="pm-shell flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="pm-page-header px-5 py-8 md:px-10 md:py-10">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">
                Super admin
              </p>
              <span className="rounded-full border border-white/90 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-600">
                {viewer.email || "Operator"}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-900 md:text-5xl">
              PostMotive admin console
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              Pricing, accounts, entitlements, and audit controls run behind
              real server-side authorization.
            </p>
            <nav className="mt-6 flex flex-wrap gap-2" aria-label="Admin console navigation">
              {adminLinks.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full border border-white/90 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_8px_24px_rgba(76,61,139,0.08)] hover:text-violet-700"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="pm-content mx-auto max-w-7xl p-4 md:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}