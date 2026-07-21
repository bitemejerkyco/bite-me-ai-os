import type { ReactNode } from "react";
import Link from "next/link";

interface QuickActionCardProps {
  icon: ReactNode;
  label: string;
  description?: string;
  href: string;
}

export function QuickActionCard({ icon, label, description, href }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-[#222] bg-[#161616] p-4 transition-colors hover:border-[#333] hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1e1e1e] text-zinc-400 transition-colors group-hover:bg-[#252525] group-hover:text-white">
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        )}
      </div>
    </Link>
  );
}
