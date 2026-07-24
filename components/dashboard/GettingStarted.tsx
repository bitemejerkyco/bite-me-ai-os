import Link from "next/link";
import { CheckCircleIcon, CircleIcon } from "lucide-react";

const steps = [
  { id: 1, label: "Create your first brand", href: "/brand-setup", done: false },
  { id: 2, label: "Upload brand documents", href: "/knowledge-hub", done: false },
  { id: 3, label: "Connect a social account", href: "/settings", done: false },
  { id: 4, label: "Launch your first campaign", href: "/campaigns", done: false },
  { id: 5, label: "Generate your first piece of content", href: "/content-studio", done: false },
];

export function GettingStarted() {
  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Getting Started</h2>
        <span className="text-xs text-zinc-500">{completed}/{steps.length} complete</span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#2a2a2a]">
        <div
          className="h-full rounded-full bg-red-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
        />
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-[#1e1e1e]"
            >
              {step.done ? (
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              ) : (
                <CircleIcon className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
              )}
              <span className={step.done ? "text-zinc-500 line-through" : "text-zinc-300"}>
                {step.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
