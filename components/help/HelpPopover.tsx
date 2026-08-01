"use client";

import { useId, useState, type ReactNode } from "react";
import HelpIconButton from "@/components/help/HelpIconButton";

export default function HelpPopover({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="relative inline-flex">
      <HelpIconButton aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen((current) => !current)}>
        ?
      </HelpIconButton>
      {open ? (
        <div id={id} className="absolute right-0 top-full z-50 mt-2 w-72 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
              Close
            </button>
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-700">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
