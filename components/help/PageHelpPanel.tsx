"use client";

import Link from "next/link";
import HelpTerm from "@/components/help/HelpTerm";
import { useHelp } from "@/components/help/HelpContext";

export default function PageHelpPanel() {
  const { pageHelp, panelExpanded, setPanelExpanded, openSearch, setAssistantOpen, walkthrough, preference, visitCount } = useHelp();

  if (!pageHelp) return null;
  if (preference.helpMode === "OFF") return null;

  const compact = !panelExpanded;
  const shouldCompactAutomatically = preference.helpMode === "AUTO" && visitCount > 2;

  return (
    <section className="mt-5 rounded-[1.8rem] border border-slate-200 bg-white/85 p-5 shadow-sm" aria-label={`Help for ${pageHelp.title}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">About this page</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">{pageHelp.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{pageHelp.shortDescription}</p>
        </div>
        <button
          type="button"
          onClick={() => setPanelExpanded(!panelExpanded)}
          aria-expanded={panelExpanded}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700"
        >
          {compact ? "Expand help" : shouldCompactAutomatically ? "Keep compact" : "Collapse help"}
        </button>
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">What this page does</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{pageHelp.purpose}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">Why this page matters</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{pageHelp.whyItMatters}</p>
              <p className="mt-3 text-sm text-slate-700"><span className="font-semibold">Recommended first action:</span> {pageHelp.recommendedFirstAction}</p>
              {pageHelp.estimatedTime ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estimated time: {pageHelp.estimatedTime}</p> : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Quick Start</p>
                {walkthrough.active?.route === pageHelp.route ? (
                  <button type="button" onClick={() => void walkthrough.resume()} className="text-xs font-semibold text-violet-700 hover:text-violet-600">
                    Resume walkthrough
                  </button>
                ) : null}
              </div>
              <ol className="mt-3 space-y-3 text-sm text-slate-700">
                {pageHelp.quickStartSteps.map((step, index) => (
                  <li key={step.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <p className="font-semibold text-slate-900">{index + 1}. {step.title}</p>
                    <p className="mt-1 leading-6">{step.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Common terms on this page</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pageHelp.terminology.map((term) => (
                  <HelpTerm key={term.term} term={term.term} />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Actions</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void walkthrough.start()} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                  Start walkthrough
                </button>
                <button type="button" onClick={openSearch} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
                  Open Help Search
                </button>
                <button type="button" onClick={() => setAssistantOpen(true)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
                  Open Help Assistant
                </button>
                {pageHelp.videoUrl ? (
                  <Link href={pageHelp.videoUrl} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
                    Watch walkthrough
                  </Link>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pageHelp.relatedPages.slice(0, 3).map((related) => (
                  <Link key={related.href} href={related.href} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
                    {related.label}
                  </Link>
                ))}
                <Link href="/academy" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
                  Academy
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
          <span>{pageHelp.recommendedFirstAction}</span>
          <button type="button" onClick={() => setAssistantOpen(true)} className="font-semibold text-violet-700 hover:text-violet-600">
            Open Help Assistant
          </button>
        </div>
      )}
    </section>
  );
}
