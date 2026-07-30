"use client";

import { useEffect, useState } from "react";
import {
  demoWorkspace,
  generateContent,
  isDemoMode,
  loadLocal,
  saveLocal,
  STORAGE_KEYS,
  type ContentDraft,
  type WorkspaceProfile,
} from "@/features/core/local-os";
import {
  loadCloudDrafts,
  loadCloudWorkspace,
  saveCloudContentFeedback,
  saveCloudDraft,
} from "@/features/core/cloud-store";

export default function AIStudio() {
  const [workspace, setWorkspace] = useState<WorkspaceProfile>(demoWorkspace());
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [entryType, setEntryType] = useState<"POST" | "AD">("POST");
  const [channel, setChannel] = useState("instagram");
  const [objective, setObjective] = useState("Drive engagement");
  const [offer, setOffer] = useState("");
  const [cta, setCta] = useState("Shop now");
  const [result, setResult] = useState<ContentDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void Promise.all([loadCloudWorkspace(), loadCloudDrafts()])
        .then(([cloudWorkspace, cloudDrafts]) => {
          setWorkspace(
            cloudWorkspace || loadLocal(STORAGE_KEYS.workspace, demoWorkspace()),
          );
          setDrafts(
            cloudDrafts.length
              ? cloudDrafts
              : loadLocal(STORAGE_KEYS.drafts, []),
          );
        })
        .catch(() => {
          setWorkspace(loadLocal(STORAGE_KEYS.workspace, demoWorkspace()));
          setDrafts(loadLocal(STORAGE_KEYS.drafts, []));
        });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      if (isDemoMode()) {
        const generated = generateContent({
          workspace,
          entryType,
          channel,
          objective,
          offer,
          callToAction: cta,
        });
        setResult({
          id: crypto.randomUUID(),
          ...generated,
          entryType,
          channel,
          objective,
          status: "DRAFT",
          createdAt: new Date().toISOString(),
          originalCopy: generated.copy,
          model: "demo",
          promptVersion: "postmotive-content-v2",
        });
        setSaved(false);
        setFeedbackMessage("");
        return;
      }
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace,
          entryType,
          channel,
          objective,
          offer,
          callToAction: cta,
        }),
      });
      const payload = (await response.json()) as {
        title?: string;
        copy?: string;
        complianceNote?: string;
        generationRunId?: string;
        model?: string;
        promptVersion?: string;
        error?: string;
      };
      if (!response.ok || !payload.title || !payload.copy || !payload.complianceNote) {
        throw new Error(payload.error || "Content generation failed.");
      }
      setResult({
        id: crypto.randomUUID(),
        title: payload.title,
        copy: payload.copy,
        complianceNote: payload.complianceNote,
        entryType,
        channel,
        objective,
        status: "DRAFT",
        createdAt: new Date().toISOString(),
        generationRunId: payload.generationRunId,
        originalCopy: payload.copy,
        model: payload.model,
        promptVersion: payload.promptVersion,
      });
      setSaved(false);
      setFeedbackMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Content generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const persistDraft = async (draft: ContentDraft): Promise<void> => {
    await saveCloudDraft(draft);
    if (draft.originalCopy && draft.copy.trim() !== draft.originalCopy.trim()) {
      await saveCloudContentFeedback({
        id: crypto.randomUUID(),
        draftId: draft.id,
        generationRunId: draft.generationRunId,
        signal: "EDITED",
        reason: "Human edited the AI-generated copy before use.",
        notes: "",
        originalCopy: draft.originalCopy,
        finalCopy: draft.copy,
        entryType: draft.entryType === "AD" ? "AD" : "POST",
        channel: draft.channel,
        createdAt: new Date().toISOString(),
      });
    }
    const exists = drafts.some((item) => item.id === draft.id);
    const next = exists
      ? drafts.map((item) => (item.id === draft.id ? draft : item))
      : [draft, ...drafts];
    setDrafts(next);
    saveLocal(STORAGE_KEYS.drafts, next);
    setSaved(true);
  };

  const save = async () => {
    if (!result) return;
    setError("");
    try {
      await persistDraft(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save draft.");
    }
  };

  const openCalendar = async () => {
    if (!result) return;
    setError("");
    try {
      if (!saved) await persistDraft(result);
      saveLocal(STORAGE_KEYS.calendarPrefill, result);
      window.location.assign("/calendar");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to prepare this content for scheduling.",
      );
    }
  };

  const recordFeedback = async (signal: "POSITIVE" | "NEGATIVE") => {
    if (!result) return;
    setError("");
    setFeedbackMessage("");
    try {
      if (!saved) await persistDraft(result);
      await saveCloudContentFeedback({
        id: crypto.randomUUID(),
        draftId: result.id,
        generationRunId: result.generationRunId,
        signal,
        reason:
          feedbackNote.trim() ||
          (signal === "POSITIVE"
            ? "Approved by the user as useful and on brand."
            : "Marked by the user as needing improvement."),
        notes: "",
        originalCopy: result.originalCopy,
        finalCopy: result.copy,
        entryType: result.entryType === "AD" ? "AD" : "POST",
        channel: result.channel,
        createdAt: new Date().toISOString(),
      });
      setFeedbackMessage(
        signal === "POSITIVE"
          ? "Positive feedback saved. Future drafts can learn from it."
          : "Improvement feedback saved. Future drafts can avoid this issue.",
      );
      setFeedbackNote("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save feedback.",
      );
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#111827] p-5 md:p-7">
        <h2 className="text-xl font-bold">Create marketing content</h2>
        <p className="mt-1 text-sm text-zinc-400">Brand: {workspace.businessName} · Compliance: {workspace.industry.replaceAll("_", " ")}</p>
        <div className="mt-6 space-y-4">
          <label className="block text-sm text-zinc-300">Content type
            <select value={entryType} onChange={(e) => setEntryType(e.target.value as "POST" | "AD")} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5">
              <option value="POST">Organic post</option>
              <option value="AD">Paid ad</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5">
              <option value="instagram">Instagram</option><option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
              <option value="email">Email</option><option value="sms">SMS</option>
              <option value="linkedin">LinkedIn</option><option value="blog">Blog</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">Objective
            <select value={objective} onChange={(e) => setObjective(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5">
              <option>Drive engagement</option><option>Generate sales</option><option>Build trust</option><option>Announce an event</option><option>Educate customers</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">Offer or message
            <textarea value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Example: Free shipping over $75" className="mt-1 min-h-28 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" />
          </label>
          <label className="block text-sm text-zinc-300">Call to action
            <input value={cta} onChange={(e) => setCta(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" />
          </label>
          <button disabled={generating} onClick={generate} className="w-full rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-500 disabled:cursor-wait disabled:opacity-60">
            {generating ? "Generating with AI…" : "Generate with AI"}
          </button>
          {entryType === "AD" ? (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-100">
              Paid ads require human approval before launch or spending.
            </p>
          ) : null}
          {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#111827] p-5 md:p-7">
        <h2 className="text-xl font-bold">Draft preview</h2>
        {!result ? <p className="mt-6 text-zinc-400">Complete the brief and generate your first draft.</p> : (
          <div className="mt-5">
            <h3 className="font-semibold">{result.title}</h3>
            <textarea value={result.copy} onChange={(e) => {
              setResult({ ...result, copy: e.target.value });
              setSaved(false);
            }} className="mt-3 min-h-44 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 leading-7" />
            <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">{result.complianceNote}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button disabled={saved} onClick={() => void save()} className="rounded-lg border border-emerald-500/40 px-4 py-2 text-emerald-300 hover:bg-emerald-500/10 disabled:cursor-default disabled:bg-emerald-500/10">
                {saved ? "Saved ✓" : drafts.some((draft) => draft.id === result.id) ? "Save changes" : "Save draft"}
              </button>
              <button onClick={() => void openCalendar()} className="rounded-lg bg-red-600 px-4 py-2 font-semibold hover:bg-red-500">
                Schedule / Post now
              </button>
            </div>
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
              <h4 className="text-sm font-semibold">Teach the PostMotive agents</h4>
              <p className="mt-1 text-xs text-zinc-400">
                Tell the system what worked or what should improve. This feedback is used in future drafts for this workspace.
              </p>
              <input
                value={feedbackNote}
                onChange={(event) => setFeedbackNote(event.target.value)}
                placeholder="Optional: strong hook, off-brand tone, incorrect detail…"
                className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button onClick={() => void recordFeedback("POSITIVE")} className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10">
                  This worked
                </button>
                <button onClick={() => void recordFeedback("NEGATIVE")} className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10">
                  Needs improvement
                </button>
              </div>
              {feedbackMessage ? <p className="mt-3 text-sm text-emerald-300">{feedbackMessage}</p> : null}
            </div>
          </div>
        )}
        <p className="mt-6 text-xs text-zinc-500">{drafts.length} drafts saved in this workspace.</p>
      </section>
    </div>
  );
}
