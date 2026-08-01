"use client";

import { getHelpTerm } from "@/features/help/term-registry";
import HelpTooltip from "@/components/help/HelpTooltip";

export default function HelpTerm({ term }: { term: string }) {
  const definition = getHelpTerm(term);
  if (!definition) return <span>{term}</span>;

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
      <span>{definition.term}</span>
      <HelpTooltip label={`Explain ${definition.term}`} content={definition.definition} />
    </span>
  );
}
