import type { ReactNode } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-300" href="/">
            {APP_NAME}
          </Link>
          <p className="text-sm text-slate-300">
            Sign in with Supabase when configured, or explore the local demo dashboard.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
