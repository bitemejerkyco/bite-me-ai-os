"use client";

import Link from "next/link";
import { useState } from "react";
import { useHelp } from "@/components/help/HelpContext";

type AssistantReply = {
  answer: string;
  route: string;
  relatedPageLabel: string;
  relatedPageHref: string;
  startWalkthrough: { id: string; title: string } | null;
  academyLesson: { lessonId: string; title: string; href: string } | null;
};

export default function HelpAssistant() {
  const { assistantOpen, setAssistantOpen, currentRoute, walkthrough } = useHelp();
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState("GENERAL_FEEDBACK");
  const [feedbackText, setFeedbackText] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  async function ask() {
    const response = await fetch("/api/help/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route: currentRoute, question }),
    });
    const payload = await response.json();
    if (payload?.ok) {
      setReply(payload.data);
    }
  }

  async function sendFeedback() {
    setSendingFeedback(true);
    try {
      await fetch("/api/help/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: feedbackCategory,
          route: currentRoute,
          browserVersion: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
          description: feedbackText,
        }),
      });
      setFeedbackText("");
    } finally {
      setSendingFeedback(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAssistantOpen(!assistantOpen)}
        className="fixed bottom-5 right-5 z-[70] rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-violet-500"
        aria-expanded={assistantOpen}
      >
        <span className="hidden sm:inline">Ask PostMotive</span>
        <span className="sm:hidden">Need Help?</span>
      </button>
      {assistantOpen ? (
        <aside className="fixed bottom-20 right-5 z-[80] w-[min(92vw,26rem)] rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Context-aware help</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">AI Trainer</h2>
            </div>
            <button type="button" onClick={() => setAssistantOpen(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">Close</button>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Ask what this page does, why a workflow is blocked, or where to go next.</p>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What do I do on this page? How do I connect TikTok? Why can't I publish?"
            className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void ask()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
              Ask
            </button>
            <button type="button" onClick={() => void walkthrough.start()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
              Start walkthrough
            </button>
          </div>
          {reply ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm leading-6 text-slate-700">{reply.answer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={reply.relatedPageHref} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  Open related page
                </Link>
                {reply.startWalkthrough ? (
                  <button type="button" onClick={() => void walkthrough.start(reply.startWalkthrough?.id)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    Start walkthrough
                  </button>
                ) : null}
                {reply.academyLesson ? (
                  <Link href={reply.academyLesson.href} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    Open academy lesson
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-900">Feedback</p>
            <div className="mt-3 grid gap-2">
              <select value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <option value="BUG_REPORT">Bug report</option>
                <option value="FEATURE_REQUEST">Feature request</option>
                <option value="GENERAL_FEEDBACK">General feedback</option>
                <option value="CONFUSING_INSTRUCTIONS">Confusing instructions</option>
                <option value="MISSING_HELP_TOPIC">Missing help topic</option>
              </select>
              <textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Tell us what is confusing or missing." className="min-h-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" />
              <button type="button" disabled={sendingFeedback || !feedbackText.trim()} onClick={() => void sendFeedback()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                {sendingFeedback ? "Sending..." : "Send feedback"}
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
