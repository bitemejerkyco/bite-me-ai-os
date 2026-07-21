import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center rounded-2xl border border-[var(--border)] bg-zinc-900/30 p-6 md:p-10">
        {children}
      </div>
    </div>
  );
}
