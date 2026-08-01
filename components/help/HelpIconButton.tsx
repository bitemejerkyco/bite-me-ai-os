"use client";

import type { ButtonHTMLAttributes } from "react";

export default function HelpIconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-violet-300 hover:text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 ${className}`.trim()}
    >
      {children || "?"}
    </button>
  );
}
