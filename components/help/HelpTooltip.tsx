"use client";

import { useId, useState } from "react";
import HelpIconButton from "@/components/help/HelpIconButton";

export default function HelpTooltip({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex items-center gap-2">
      <HelpIconButton
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </HelpIconButton>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-2 max-w-xs rounded-2xl border border-slate-200 bg-white p-3 text-left text-xs leading-5 text-slate-700 shadow-xl"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
