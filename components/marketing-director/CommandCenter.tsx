"use client";

import { useState } from "react";
import type { CommandRouterResult } from "@/features/marketing-director/command-router";

type ResponseState = {
  ok: boolean;
  message?: string;
  error?: string;
  proposal?: CommandRouterResult;
};

export default function CommandCenter(props: { modeLabel: string }) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<ResponseState | null>(null);
  const suggestions = [
    "Build my next 30-day campaign",
    "Improve my Amazon advertising",
    "Create a TikTok content plan",
    "Review pending content",
    "Improve my Marketing Score",
    "Analyze connected channel performance",
  ];

  const submit = async () => {
    if (!prompt.trim()) {
      setState({ ok: false, error: "Enter a command request first." });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/marketing-director/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const payload = (await response.json().catch(() => null)) as ResponseState | null;
      if (!response.ok || !payload?.ok) {
        setState({ ok: false, error: payload?.error || "Unable to create proposal." });
      } else {
        setState({ ok: true, message: payload.message, proposal: payload.proposal });
      }
    } catch {
      setState({ ok: false, error: "Network error while sending command." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Command Center</p>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
          {props.modeLabel}
        </span>
      </div>
      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900 md:text-2xl">
        What would you like your Marketing Director to do?
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Advisor mode creates a reviewable plan and does not execute automatically.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setPrompt(suggestion)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        maxLength={500}
        className="mt-4 min-h-40 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        placeholder="Example: Build a 2-week TikTok content plan for our new product launch"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{prompt.length} / 500</p>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 active:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Generating proposal..." : "Generate proposal"}
        </button>
      </div>

      {state?.error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>
      ) : null}

      {state?.ok && state.proposal ? (
        <article className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{state.proposal.summary}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {state.proposal.proposedSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Approval required: {state.proposal.requiresApproval ? "Yes" : "No"}</p>
        </article>
      ) : null}
    </section>
  );
}
