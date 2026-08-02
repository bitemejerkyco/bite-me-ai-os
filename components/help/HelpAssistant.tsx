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
  const { assistantOpen, setAssistantOpen, currentRoute, walkthrough, helpContextData } = useHelp();
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState("GENERAL_FEEDBACK");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackScreenshot, setFeedbackScreenshot] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{ id: string } | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [helpfulVote, setHelpfulVote] = useState<"yes" | "no" | null>(null);

  async function ask() {
    setHelpfulVote(null);
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
    setFeedbackResult(null);
    setFeedbackError(null);
    try {
      const response = await fetch("/api/help/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: feedbackCategory,
          route: currentRoute,
          browserVersion: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
          appVersion: helpContextData.appVersion || process.env.NEXT_PUBLIC_APP_VERSION || "dev",
          description: feedbackText,
          screenshotUrl: feedbackScreenshot || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        const referenceId = payload?.referenceId || "feedback-submit-error";
        throw new Error(`${payload?.error || "Unable to submit feedback."} (ref: ${referenceId})`);
      }
      setFeedbackResult({ id: String(payload.feedbackId || "pending-id") });
      setFeedbackText("");
      setFeedbackScreenshot("");
      setFeedbackCategory("GENERAL_FEEDBACK");
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Unable to submit feedback.");
    } finally {
      setSendingFeedback(false);
    }
  }

  return (
    <>
      <button
        data-help="ask-postmotive"
        type="button"
        onClick={() => setAssistantOpen(!assistantOpen)}
        className="ask-motive-button fixed bottom-5 right-5 z-[70] text-sm font-semibold"
        aria-label="Open Ask Motive assistant"
        title="Pick PostMotive’s brain"
        aria-expanded={assistantOpen}
      >
        <span className="ask-motive-button__glow" aria-hidden="true" />
        <span className="ask-motive-button__content">
          <span>Ask Motive</span>
          {helpContextData.betaTesterMode ? <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">Beta</span> : null}
        </span>
      </button>
      {assistantOpen ? (
        <aside className="fixed bottom-20 right-5 z-[80] w-[min(92vw,26rem)] rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Context-aware help</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">Ask Motive</h2>
              {helpContextData.betaTesterMode ? (
                <p className="mt-1 text-xs font-semibold text-slate-500">Beta mode · {helpContextData.appVersion}</p>
              ) : null}
            </div>
            <button type="button" onClick={() => setAssistantOpen(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">Close</button>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Ask questions, explore your knowledge, and get answers tailored to your business.</p>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What would you like to ask Motive?"
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
          {!reply ? (
            <p className="mt-4 text-sm font-semibold text-slate-900">What can Motive help you with?</p>
          ) : null}
          {reply ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{reply.answer}</p>
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
              {helpContextData.betaTesterMode ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Was this helpful?</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => setHelpfulVote("yes")} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${helpfulVote === "yes" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700"}`}>
                      Yes
                    </button>
                    <button type="button" onClick={() => setHelpfulVote("no")} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${helpfulVote === "no" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-700"}`}>
                      Not yet
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-900">Send Beta Feedback</p>
            <div className="mt-3 grid gap-2">
              <select value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <option value="BUG">Bug</option>
                <option value="CONFUSING_WORKFLOW">Confusing workflow</option>
                <option value="MISSING_INSTRUCTIONS">Missing instructions</option>
                <option value="FEATURE_REQUEST">Feature request</option>
                <option value="DESIGN_ISSUE">Design issue</option>
                <option value="GENERAL_FEEDBACK">General feedback</option>
              </select>
              <textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Describe the issue, workflow confusion, or request." className="min-h-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" />
              <input value={feedbackScreenshot} onChange={(event) => setFeedbackScreenshot(event.target.value)} placeholder="Optional screenshot URL" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" />
              <button type="button" disabled={sendingFeedback || !feedbackText.trim()} onClick={() => void sendFeedback()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                {sendingFeedback ? "Sending..." : "Send Beta Feedback"}
              </button>
              {feedbackResult ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Thank you. Your feedback was submitted. Reference: {feedbackResult.id}
                </p>
              ) : null}
              {feedbackError ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{feedbackError}</p> : null}
            </div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
