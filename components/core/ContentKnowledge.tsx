"use client";

import { useEffect, useState } from "react";
import { loadCloudKnowledge } from "@/features/core/cloud-store";
import type { ContentKnowledgeItem } from "@/features/core/local-os";

const gradeStyle: Record<ContentKnowledgeItem["grade"], string> = {
  A: "bg-emerald-500/20 text-emerald-200",
  B: "bg-blue-500/20 text-blue-200",
  C: "bg-amber-500/20 text-amber-200",
  D: "bg-red-500/20 text-red-200",
};

export default function ContentKnowledge() {
  const [items, setItems] = useState<ContentKnowledgeItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadCloudKnowledge()
        .then(setItems)
        .catch((caught: unknown) =>
          setMessage(
            caught instanceof Error
              ? caught.message
              : "Unable to load the Knowledge Base.",
          ),
        );
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
        <h2 className="text-xl font-bold">Proven content knowledge</h2>
        <p className="mt-2 text-sm text-zinc-300">
          High-performing posts and ads saved here provide verified continuity for future AI creation. Low-confidence results are excluded from automatic learning.
        </p>
      </section>

      {message ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">{message}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#111827] p-6 text-zinc-400">
            No proven winners have been added yet. Open a high-scoring Calendar scorecard and select “Add to Knowledge Base.”
          </div>
        ) : items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-white/10 bg-[#111827] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-xs ${gradeStyle[item.grade]}`}>
                {item.score}/100 · Grade {item.grade}
              </span>
              <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs">
                {item.entryType === "AD" ? "PAID AD" : "ORGANIC POST"}
              </span>
              <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs">
                {item.confidence} CONFIDENCE
              </span>
            </div>
            <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{item.channel}</p>
            <div className="mt-4 whitespace-pre-wrap rounded-xl border border-white/10 bg-zinc-950 p-4 text-sm leading-6">
              {item.content}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.strengths.map((strength) => (
                <span key={strength} className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                  {strength}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
