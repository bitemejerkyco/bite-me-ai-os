"use client";

import Link from "next/link";
import { useState } from "react";
import type { AcademyLesson } from "@/features/help/types";

type ProgressMap = Record<string, { status: string; completionPercentage: number }>;

export default function AcademyLessonList({
  lessons,
  progress,
}: {
  lessons: AcademyLesson[];
  progress: ProgressMap;
}) {
  const [localProgress, setLocalProgress] = useState(progress);

  async function updateLesson(lessonId: string, status: "IN_PROGRESS" | "COMPLETED", completionPercentage: number) {
    await fetch("/api/help/academy-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, status, completionPercentage }),
    });
    setLocalProgress((current) => ({
      ...current,
      [lessonId]: { status, completionPercentage },
    }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {lessons.map((lesson) => {
        const state = localProgress[lesson.lessonId] || { status: "NOT_STARTED", completionPercentage: 0 };
        return (
          <article key={lesson.lessonId} className="rounded-[1.8rem] border border-slate-200 bg-white/85 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">{lesson.category}</p>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {state.status.replaceAll("_", " ")} · {state.completionPercentage}%
              </span>
            </div>
            <h2 className="mt-2 text-lg font-black tracking-tight text-slate-900">{lesson.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{lesson.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{lesson.durationMinutes} min</span>
              <span>{lesson.difficulty}</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {lesson.steps.slice(0, 3).map((step) => (
                <li key={step.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 leading-6">{step.description}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => void updateLesson(lesson.lessonId, "IN_PROGRESS", Math.max(state.completionPercentage, 25))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                Start lesson
              </button>
              <button type="button" onClick={() => void updateLesson(lesson.lessonId, "COMPLETED", 100)} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                Mark complete
              </button>
              {lesson.relatedRoutes[0] ? (
                <Link href={lesson.relatedRoutes[0]} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  Open related page
                </Link>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
