"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cancelCloudScheduledPost,
  loadCloudDrafts,
  loadCloudSchedule,
  saveCloudScheduledPost,
} from "@/features/core/cloud-store";
import {
  loadLocal,
  saveLocal,
  STORAGE_KEYS,
  type ContentDraft,
  type ScheduledPost,
} from "@/features/core/local-os";

function localDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthCells(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

const statusStyle: Record<ScheduledPost["status"], string> = {
  DRAFT: "bg-zinc-700 text-zinc-200",
  PENDING_APPROVAL: "bg-amber-500/20 text-amber-200",
  SCHEDULED: "bg-blue-500/20 text-blue-200",
  PUBLISHING: "bg-purple-500/20 text-purple-200",
  PUBLISHED: "bg-emerald-500/20 text-emerald-200",
  FAILED: "bg-red-500/20 text-red-200",
  CANCELED: "bg-zinc-800 text-zinc-400",
};

const CHANNELS: ScheduledPost["channel"][] = [
  "TikTok",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Email",
  "SMS",
  "Blog",
];

function calendarChannel(value: string): ScheduledPost["channel"] {
  const match = CHANNELS.find(
    (channel) => channel.toLowerCase() === value.toLowerCase(),
  );
  return match || "TikTok";
}

function draftForm(draft: ContentDraft) {
  return {
    selectedDraftId: draft.id,
    contentDraftId: draft.id,
    entryType: draft.entryType === "AD" ? ("AD" as const) : ("POST" as const),
    channel: calendarChannel(draft.channel),
    title: draft.title,
    content: draft.copy,
  };
}

export default function ContentCalendar() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [contentDraftId, setContentDraftId] = useState<string | undefined>();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [entryType, setEntryType] = useState<ScheduledPost["entryType"]>("POST");
  const [channel, setChannel] = useState<ScheduledPost["channel"]>("TikTok");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(localDate(tomorrow));
  const [time, setTime] = useState("09:00");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void Promise.all([loadCloudSchedule(), loadCloudDrafts()])
        .then(([schedule, savedDrafts]) => {
          setPosts(schedule);
          setDrafts(savedDrafts);
          const prefill = loadLocal<ContentDraft | null>(
            STORAGE_KEYS.calendarPrefill,
            null,
          );
          if (prefill) {
            const form = draftForm(prefill);
            setSelectedDraftId(form.selectedDraftId);
            setContentDraftId(form.contentDraftId);
            setEntryType(form.entryType);
            setChannel(form.channel);
            setTitle(form.title);
            setContent(form.content);
            saveLocal(STORAGE_KEYS.calendarPrefill, null);
            setMessage("AI Studio content loaded. Choose Schedule or Post now.");
          }
        })
        .catch((caught: unknown) => {
          setMessage(
            caught instanceof Error ? caught.message : "Unable to load calendar.",
          );
        });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const cells = useMemo(() => monthCells(month), [month]);
  const postsByDate = useMemo(() => {
    const grouped = new Map<string, ScheduledPost[]>();
    posts.forEach((post) => {
      const key = localDate(new Date(post.scheduledFor));
      grouped.set(key, [...(grouped.get(key) || []), post]);
    });
    return grouped;
  }, [posts]);

  const submit = async (postNow: boolean) => {
    if (!title.trim() || !content.trim()) {
      setMessage("Add a title and post content first.");
      return;
    }
    const scheduledFor = postNow
      ? new Date().toISOString()
      : new Date(`${date}T${time}:00`).toISOString();
    if (!postNow && new Date(scheduledFor).getTime() <= Date.now()) {
      setMessage("Choose a future date and time.");
      return;
    }
    const post: ScheduledPost = {
      id: crypto.randomUUID(),
      entryType,
      channel,
      title: title.trim(),
      content: content.trim(),
      scheduledFor,
      timezone,
      status: entryType === "AD" ? "PENDING_APPROVAL" : "SCHEDULED",
      contentDraftId,
    };
    setWorking(true);
    setMessage("");
    try {
      await saveCloudScheduledPost(post);
      setPosts((current) => [...current, post]);
      setTitle("");
      setContent("");
      setSelectedDraftId("");
      setContentDraftId(undefined);
      setMessage(
        entryType === "AD"
          ? "Ad submitted for approval. No spend was authorized."
          : postNow
            ? "Post queued for immediate publishing."
            : "Post scheduled.",
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to schedule.");
    } finally {
      setWorking(false);
    }
  };

  const approve = async (post: ScheduledPost) => {
    const approved = {
      ...post,
      status: "SCHEDULED" as const,
      approvedAt: new Date().toISOString(),
    };
    try {
      await saveCloudScheduledPost(approved);
      setPosts((current) =>
        current.map((item) => (item.id === post.id ? approved : item)),
      );
      setMessage("Ad approved and added to the publishing queue.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to approve ad.");
    }
  };

  const cancel = async (post: ScheduledPost) => {
    try {
      await cancelCloudScheduledPost(post);
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id ? { ...item, status: "CANCELED" } : item,
        ),
      );
      setMessage("Scheduled item canceled.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to cancel.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100">
        Calendar and approval queue are active. Items will remain safely queued until the selected channel is connected. Ads always require approval before launch or spending.
      </section>

      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
          <h2 className="text-xl font-bold">Create scheduled content</h2>
          <div className="mt-5 space-y-4">
            <label className="block text-sm text-zinc-300">Use AI Studio draft
              <select
                value={selectedDraftId}
                onChange={(event) => {
                  const draft = drafts.find((item) => item.id === event.target.value);
                  if (draft) {
                    const form = draftForm(draft);
                    setSelectedDraftId(form.selectedDraftId);
                    setContentDraftId(form.contentDraftId);
                    setEntryType(form.entryType);
                    setChannel(form.channel);
                    setTitle(form.title);
                    setContent(form.content);
                  }
                  else {
                    setSelectedDraftId("");
                    setContentDraftId(undefined);
                  }
                }}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5"
              >
                <option value="">Create from scratch</option>
                {drafts.map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {draft.entryType === "AD" ? "Ad" : "Post"} · {draft.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-zinc-300">Content type
              <select value={entryType} onChange={(event) => setEntryType(event.target.value as ScheduledPost["entryType"])} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5">
                <option value="POST">Organic post</option>
                <option value="AD">Paid ad</option>
              </select>
            </label>
            <label className="block text-sm text-zinc-300">Channel
              <select value={channel} onChange={(event) => setChannel(event.target.value as ScheduledPost["channel"])} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5">
                {CHANNELS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="block text-sm text-zinc-300">Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Behind the scenes" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" />
            </label>
            <label className="block text-sm text-zinc-300">Post or ad content
              <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write or paste the approved content" className="mt-1 min-h-28 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-zinc-300">Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" />
              </label>
              <label className="block text-sm text-zinc-300">Time
                <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" />
              </label>
            </div>
            <p className="text-xs text-zinc-500">Timezone: {timezone}</p>
            <div className="grid grid-cols-2 gap-3">
              <button disabled={working} onClick={() => void submit(false)} className="rounded-lg border border-red-500/40 px-4 py-3 font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-60">
                Schedule
              </button>
              <button disabled={working} onClick={() => void submit(true)} className="rounded-lg bg-red-600 px-4 py-3 font-semibold hover:bg-red-500 disabled:opacity-60">
                Post now
              </button>
            </div>
            {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111827] p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg border border-white/10 px-3 py-2">←</button>
            <h2 className="text-xl font-bold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg border border-white/10 px-3 py-2">→</button>
          </div>
          <div className="mt-4 grid grid-cols-7 text-center text-xs text-zinc-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-2">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-white/10">
            {cells.map((day) => {
              const key = localDate(day);
              const dayPosts = postsByDate.get(key) || [];
              return (
                <div key={key} className={`min-h-24 border-b border-r border-white/5 p-1.5 ${day.getMonth() === month.getMonth() ? "bg-black/10" : "bg-black/30 text-zinc-600"}`}>
                  <p className="text-xs">{day.getDate()}</p>
                  <div className="mt-1 space-y-1">
                    {dayPosts.slice(0, 3).map((post) => (
                      <div key={post.id} title={post.title} className={`truncate rounded px-1.5 py-1 text-[10px] ${statusStyle[post.status]}`}>
                        {post.channel}: {post.title}
                      </div>
                    ))}
                    {dayPosts.length > 3 ? <p className="text-[10px] text-zinc-500">+{dayPosts.length - 3} more</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#111827] p-5">
        <h2 className="text-xl font-bold">Publishing queue</h2>
        <div className="mt-4 space-y-3">
          {posts.length === 0 ? <p className="text-zinc-400">Nothing scheduled yet.</p> : posts.map((post) => (
            <article key={post.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{post.title}</h3>
                  <span className={`rounded-full px-2 py-1 text-xs ${statusStyle[post.status]}`}>{post.status.replaceAll("_", " ")}</span>
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs">{post.entryType}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{post.channel} · {new Date(post.scheduledFor).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                {post.status === "PENDING_APPROVAL" ? <button onClick={() => void approve(post)} className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-300">Approve & schedule</button> : null}
                {!["PUBLISHED", "CANCELED"].includes(post.status) ? <button onClick={() => void cancel(post)} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300">Cancel</button> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
