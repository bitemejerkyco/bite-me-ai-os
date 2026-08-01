"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  cancelCloudScheduledPost,
  loadCloudDrafts,
  loadCloudKnowledge,
  loadCloudPerformance,
  loadCloudSchedule,
  resolveCloudMediaUrl,
  saveCloudKnowledge,
  saveCloudScheduledPost,
} from "@/features/core/cloud-store";
import {
  calculateContentScore,
  type ContentScore,
} from "@/features/core/content-score";
import {
  loadLocal,
  saveLocal,
  STORAGE_KEYS,
  type ContentDraft,
  type ContentKnowledgeItem,
  type PerformanceSnapshot,
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
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-500/20 text-amber-800",
  SCHEDULED: "bg-blue-500/20 text-blue-700",
  PUBLISHING: "bg-purple-500/20 text-purple-700",
  DELIVERED_TO_INBOX: "bg-cyan-500/20 text-cyan-700",
  PUBLISHED: "bg-emerald-500/20 text-emerald-700",
  FAILED: "bg-rose-100 text-rose-700",
  CANCELED: "bg-slate-100 text-slate-500",
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
    videoProjectId: draft.videoProjectId,
    mediaStoragePath: draft.mediaStoragePath,
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ContentCalendar() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [performance, setPerformance] = useState<PerformanceSnapshot[]>([]);
  const [knowledge, setKnowledge] = useState<ContentKnowledgeItem[]>([]);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [contentDraftId, setContentDraftId] = useState<string | undefined>();
  const [videoProjectId, setVideoProjectId] = useState<string | undefined>();
  const [mediaStoragePath, setMediaStoragePath] = useState<string | undefined>();
  const [selectedMediaUrl, setSelectedMediaUrl] = useState("");
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [entryType, setEntryType] = useState<ScheduledPost["entryType"]>("POST");
  const [channel, setChannel] = useState<ScheduledPost["channel"]>("TikTok");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(localDate(tomorrow));
  const [time, setTime] = useState("09:00");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const detailsRef = useRef<HTMLElement | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const preferredView = new URLSearchParams(window.location.search).get("view")?.toLowerCase();
      void Promise.all([
        loadCloudSchedule(),
        loadCloudDrafts(),
        loadCloudPerformance(),
        loadCloudKnowledge(),
      ])
        .then(([schedule, savedDrafts, snapshots, knowledgeItems]) => {
          setPosts(schedule);
          setDrafts(savedDrafts);
          setPerformance(snapshots);
          setKnowledge(knowledgeItems);
          const preferredScheduled =
            preferredView === "scheduled"
              ? schedule.find((item) => ["SCHEDULED", "PUBLISHING", "DELIVERED_TO_INBOX"].includes(item.status))
              : null;
          setSelectedPost(
            preferredScheduled ||
              schedule.find((item) => item.status === "PENDING_APPROVAL") ||
              schedule.find((item) => item.status === "SCHEDULED") ||
              schedule[0] ||
              null,
          );
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
            setVideoProjectId(form.videoProjectId);
            setMediaStoragePath(form.mediaStoragePath);
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

  useEffect(() => {
    const path = selectedPost?.mediaStoragePath;
    const frame = requestAnimationFrame(() => {
      if (!path) {
        setSelectedMediaUrl("");
        return;
      }
      void resolveCloudMediaUrl(path)
        .then(setSelectedMediaUrl)
        .catch(() => setSelectedMediaUrl(""));
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedPost?.mediaStoragePath]);

  const cells = useMemo(() => monthCells(month), [month]);
  const postsByDate = useMemo(() => {
    const grouped = new Map<string, ScheduledPost[]>();
    posts.forEach((post) => {
      const key = localDate(new Date(post.scheduledFor));
      grouped.set(key, [...(grouped.get(key) || []), post]);
    });
    return grouped;
  }, [posts]);
  const latestPerformanceByPost = useMemo(() => {
    const latest = new Map<string, PerformanceSnapshot>();
    performance.forEach((snapshot) => {
      if (!latest.has(snapshot.scheduledPostId)) {
        latest.set(snapshot.scheduledPostId, snapshot);
      }
    });
    return latest;
  }, [performance]);
  const scorecards = useMemo(
    () =>
      posts
        .map((post) => {
          const snapshot = latestPerformanceByPost.get(post.id);
          return snapshot
            ? { post, snapshot, score: calculateContentScore(post, snapshot) }
            : null;
        })
        .filter(
          (
            item,
          ): item is {
            post: ScheduledPost;
            snapshot: PerformanceSnapshot;
            score: ContentScore;
          } => Boolean(item),
        )
        .sort((left, right) => right.score.score - left.score.score),
    [latestPerformanceByPost, posts],
  );
  const selectedSnapshot = selectedPost
    ? latestPerformanceByPost.get(selectedPost.id)
    : undefined;
  const selectedScore =
    selectedPost && selectedSnapshot
      ? calculateContentScore(selectedPost, selectedSnapshot)
      : null;
  const selectedDayPosts = selectedDay
    ? postsByDate.get(selectedDay) || []
    : [];

  const openPost = (post: ScheduledPost) => {
    setSelectedPost(post);
    setSelectedDay("");
    window.setTimeout(() => {
      detailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const submit = async (postNow: boolean) => {
    if (!title.trim() || !content.trim()) {
      setMessage("Add a title and post content first.");
      return;
    }
    if (
      postNow &&
      entryType === "POST" &&
      channel === "TikTok" &&
      !mediaStoragePath
    ) {
      setMessage("Select an AI Studio draft with a completed video first.");
      return;
    }
    const scheduledFor = postNow
      ? new Date().toISOString()
      : new Date(`${date}T${time}:00`).toISOString();
    if (
      !postNow &&
      new Date(scheduledFor).getTime() <= new Date().getTime()
    ) {
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
      videoProjectId,
      mediaStoragePath,
    };
    setWorking(true);
    setMessage("");
    try {
      await saveCloudScheduledPost(post);
      setPosts((current) => [...current, post]);
      setSelectedPost(post);
      setTitle("");
      setContent("");
      setSelectedDraftId("");
      setContentDraftId(undefined);
      setVideoProjectId(undefined);
      setMediaStoragePath(undefined);
      if (
        postNow &&
        entryType === "POST" &&
        channel === "TikTok" &&
        post.mediaStoragePath
      ) {
        await sendToTikTok(post);
      } else {
        setMessage(
          entryType === "AD"
            ? "Ad submitted for approval. No spend was authorized."
            : postNow
              ? "Post queued for immediate publishing."
              : "Post scheduled.",
        );
      }
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
      setSelectedPost(approved);
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
      setSelectedPost({ ...post, status: "CANCELED" });
      setMessage("Scheduled item canceled.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to cancel.");
    }
  };

  const addToKnowledge = async (
    post: ScheduledPost,
    snapshot: PerformanceSnapshot,
    score: ContentScore,
  ) => {
    if (score.score < 75 || score.confidence === "LOW") {
      setMessage(
        "This result needs a score of at least 75 and medium confidence before it can teach future content.",
      );
      return;
    }
    const item: ContentKnowledgeItem = {
      id: crypto.randomUUID(),
      scheduledPostId: post.id,
      performanceSnapshotId: snapshot.id,
      entryType: post.entryType,
      channel: post.channel,
      title: post.title,
      content: post.content,
      score: score.score,
      grade: score.grade,
      confidence: score.confidence,
      strengths: score.strengths,
      scoreVersion: score.version,
      active: true,
      createdAt: new Date().toISOString(),
    };
    try {
      await saveCloudKnowledge(item);
      setKnowledge((current) => [
        item,
        ...current.filter(
          (knowledgeItem) =>
            knowledgeItem.scheduledPostId !== post.id,
        ),
      ]);
      setMessage("Winner added to the Knowledge Base. Future AI drafts can learn from it.");
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Unable to add this result to the Knowledge Base.",
      );
    }
  };

  const sendToTikTok = async (post: ScheduledPost) => {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/tiktok/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduledPostId: post.id }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { publishId?: string };
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to send video to TikTok.");
      }
      const updated = {
        ...post,
        status: "PUBLISHING" as const,
        providerJobId: payload.data?.publishId,
        failureReason: undefined,
      };
      setPosts((current) =>
        current.map((item) => (item.id === post.id ? updated : item)),
      );
      setSelectedPost(updated);
      setMessage(
        "Video sent to TikTok. PostMotive will update the delivery status automatically.",
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to send video to TikTok.",
      );
    } finally {
      setWorking(false);
    }
  };

  const refreshTikTokDelivery = async (post: ScheduledPost) => {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/integrations/tiktok/upload/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduledPostId: post.id }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: {
          status?: ScheduledPost["status"];
          failureReason?: string | null;
        };
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.data?.status) {
        throw new Error(payload.error || "Unable to refresh TikTok status.");
      }
      const updated = {
        ...post,
        status: payload.data.status,
        failureReason: payload.data.failureReason || undefined,
        publishedAt:
          payload.data.status === "PUBLISHED"
            ? new Date().toISOString()
            : post.publishedAt,
      };
      setPosts((current) =>
        current.map((item) => (item.id === post.id ? updated : item)),
      );
      setSelectedPost(updated);
      setMessage(
        payload.data.status === "DELIVERED_TO_INBOX"
          ? "Video delivered. Open TikTok and tap the inbox notification to edit and post it."
          : payload.data.status === "PUBLISHED"
            ? "TikTok confirms the video was posted."
            : payload.data.status === "FAILED"
              ? `TikTok delivery failed: ${payload.data.failureReason || "Unknown error"}`
              : "TikTok is still processing the video.",
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Unable to refresh TikTok status.",
      );
    } finally {
      setWorking(false);
    }
  };

  const activeTikTokDeliveryIds = posts
    .filter(
      (post) =>
        post.channel === "TikTok" &&
        post.status === "PUBLISHING" &&
        Boolean(post.providerJobId),
    )
    .map((post) => post.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!activeTikTokDeliveryIds) return;
    const scheduledPostIds = activeTikTokDeliveryIds.split(",");
    let disposed = false;
    const poll = async () => {
      await Promise.all(
        scheduledPostIds.map(async (scheduledPostId) => {
          try {
            const response = await fetch(
              "/api/integrations/tiktok/upload/status",
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ scheduledPostId }),
              },
            );
            const payload = (await response.json()) as {
              ok?: boolean;
              data?: {
                status?: ScheduledPost["status"];
                failureReason?: string | null;
              };
            };
            if (
              disposed ||
              !response.ok ||
              !payload.ok ||
              !payload.data?.status
            ) {
              return;
            }
            setPosts((current) =>
              current.map((item) =>
                item.id === scheduledPostId
                  ? {
                      ...item,
                      status: payload.data!.status!,
                      failureReason:
                        payload.data!.failureReason || undefined,
                    }
                  : item,
              ),
            );
            setSelectedPost((current) =>
              current?.id === scheduledPostId
                ? {
                    ...current,
                    status: payload.data!.status!,
                    failureReason: payload.data!.failureReason || undefined,
                  }
                : current,
            );
            if (payload.data.status === "DELIVERED_TO_INBOX") {
              setMessage(
                "Delivered to TikTok. Open the TikTok inbox notification to edit and post.",
              );
            } else if (payload.data.status === "FAILED") {
              setMessage(
                `TikTok delivery failed: ${payload.data.failureReason || "Unknown error"}`,
              );
            }
          } catch {
            // Keep the item queued and try again on the next polling interval.
          }
        }),
      );
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 6_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeTikTokDeliveryIds]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-800">
        Calendar and approval queue are active. Items will remain safely queued until the selected channel is connected. Ads always require approval before launch or spending.
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["AI drafts", drafts.length, "text-slate-700"],
          ["Approval needed", posts.filter((post) => post.status === "PENDING_APPROVAL").length, "text-amber-800"],
          ["Scheduled", posts.filter((post) => post.status === "SCHEDULED").length, "text-blue-700"],
          ["Publishing", posts.filter((post) => ["PUBLISHING", "DELIVERED_TO_INBOX"].includes(post.status)).length, "text-purple-700"],
          ["Published", posts.filter((post) => post.status === "PUBLISHED").length, "text-emerald-700"],
          ["Failed", posts.filter((post) => post.status === "FAILED").length, "text-rose-700"],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      {posts.some((post) => post.status === "PENDING_APPROVAL") ? (
        <section className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="text-xl font-bold text-amber-800">Ads awaiting approval</h2>
          <div className="mt-4 space-y-3">
            {posts.filter((post) => post.status === "PENDING_APPROVAL").map((post) => (
              <article key={post.id} className="flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-white/70 p-4 md:flex-row md:items-center md:justify-between">
                <button onClick={() => openPost(post)} className="text-left">
                  <p className="font-semibold">{post.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{post.channel} · {new Date(post.scheduledFor).toLocaleString()}</p>
                </button>
                <div className="flex gap-2">
                  <button onClick={() => openPost(post)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">View ad</button>
                  <button onClick={() => void approve(post)} className="rounded-xl border border-emerald-500/40 px-3 py-2 text-sm text-emerald-700">Approve & schedule</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5">
          <h2 className="text-xl font-bold">Create scheduled content</h2>
          <div className="mt-5 space-y-4">
            <label className="block text-sm text-slate-700">Use AI Studio draft
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
                    setVideoProjectId(form.videoProjectId);
                    setMediaStoragePath(form.mediaStoragePath);
                  }
                  else {
                    setSelectedDraftId("");
                    setContentDraftId(undefined);
                    setVideoProjectId(undefined);
                    setMediaStoragePath(undefined);
                  }
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                <option value="">Create from scratch</option>
                {drafts.map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {draft.entryType === "AD" ? "Ad" : "Post"} · {draft.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-700">Content type
              <select value={entryType} onChange={(event) => setEntryType(event.target.value as ScheduledPost["entryType"])} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <option value="POST">Organic post</option>
                <option value="AD">Paid ad</option>
              </select>
            </label>
            <label className="block text-sm text-slate-700">Channel
              <select value={channel} onChange={(event) => setChannel(event.target.value as ScheduledPost["channel"])} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                {CHANNELS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="block text-sm text-slate-700">Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Behind the scenes" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" />
            </label>
            <label className="block text-sm text-slate-700">Post or ad content
              <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write or paste the approved content" className="mt-1 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-slate-700">Date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" />
              </label>
              <label className="block text-sm text-slate-700">Time
                <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" />
              </label>
            </div>
            <p className="text-xs text-slate-400">Timezone: {timezone}</p>
            <div className="grid grid-cols-2 gap-3">
              <button disabled={working} onClick={() => void submit(false)} className="rounded-xl border border-violet-300 px-4 py-3 font-semibold text-rose-700 hover:bg-violet-500/10 disabled:opacity-60">
                Schedule
              </button>
              <button disabled={working} onClick={() => void submit(true)} className="rounded-xl bg-violet-600 px-4 py-3 font-semibold hover:bg-violet-500 disabled:opacity-60">
                {entryType === "POST" &&
                channel === "TikTok" &&
                mediaStoragePath
                  ? "Send to TikTok"
                  : "Post now"}
              </button>
            </div>
            {message ? <p className="text-sm text-slate-700">{message}</p> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-xl border border-slate-200/80 px-3 py-2">←</button>
            <h2 className="text-xl font-bold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-xl border border-slate-200/80 px-3 py-2">→</button>
          </div>
          <div className="mt-4 grid grid-cols-7 text-center text-xs text-slate-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-2">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-slate-200/80">
            {cells.map((day) => {
              const key = localDate(day);
              const dayPosts = postsByDate.get(key) || [];
              return (
                <div key={key} className={`min-h-24 border-b border-r border-slate-200/60 p-1.5 ${day.getMonth() === month.getMonth() ? "bg-white/50" : "bg-slate-50/70 text-slate-400"}`}>
                  <p className="text-xs">{day.getDate()}</p>
                  <div className="mt-1 space-y-1">
                    {dayPosts.slice(0, 3).map((post) => (
                      <button
                        key={post.id}
                        title={`${post.entryType}: ${post.title}`}
                        onClick={() => openPost(post)}
                        className={`block w-full truncate rounded px-1.5 py-1 text-left text-[10px] ring-offset-white hover:ring-1 hover:ring-violet-300 ${statusStyle[post.status]} ${post.entryType === "AD" ? "border border-amber-400/40" : ""}`}
                      >
                        {post.entryType} · {post.channel}: {post.title}
                      </button>
                    ))}
                    {dayPosts.length > 3 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedDay(key)}
                        className="w-full rounded px-1.5 py-1 text-left text-[10px] font-semibold text-violet-700 hover:bg-violet-100"
                        aria-label={`Show all ${dayPosts.length} scheduled items for ${day.toLocaleDateString()}`}
                      >
                        +{dayPosts.length - 3} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {selectedDay ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-agenda-title"
          onClick={() => setSelectedDay("")}
        >
          <section
            className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/80 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
                  Scheduled content
                </p>
                <h2 id="day-agenda-title" className="mt-1 text-2xl font-bold">
                  {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(
                    undefined,
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay("")}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {selectedDayPosts.map((post) => (
                <button
                  type="button"
                  key={post.id}
                  onClick={() => openPost(post)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50"
                >
                  <span>
                    <span className="block font-semibold">{post.title}</span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {post.channel} ·{" "}
                      {new Date(post.scheduledFor).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs ${statusStyle[post.status]}`}
                  >
                    {post.status.replaceAll("_", " ")}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {selectedPost ? (
        <section ref={detailsRef} className="scroll-mt-6 rounded-3xl border border-slate-200/80 bg-white/80 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-xs ${selectedPost.entryType === "AD" ? "bg-amber-500/20 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                  {selectedPost.entryType === "AD" ? "PAID AD" : "ORGANIC POST"}
                </span>
                <span className={`rounded-full px-2 py-1 text-xs ${statusStyle[selectedPost.status]}`}>
                  {selectedPost.status.replaceAll("_", " ")}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-bold">{selectedPost.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedPost.channel} · {new Date(selectedPost.scheduledFor).toLocaleString()} · {selectedPost.timezone}
              </p>
            </div>
            <button onClick={() => setSelectedPost(null)} className="rounded-xl border border-slate-200/80 px-3 py-2 text-sm">Close details</button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
            <div>
              {selectedMediaUrl ? (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Scheduled video
                  </h3>
                  <video
                    src={selectedMediaUrl}
                    controls
                    playsInline
                    className="mt-2 max-h-[560px] rounded-2xl bg-black"
                  />
                </div>
              ) : null}
              <h3 className="text-sm font-semibold text-slate-700">Post or ad content</h3>
              <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200/80 bg-white p-4 leading-7">
                {selectedPost.content}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Source: {selectedPost.contentDraftId ? "AI Studio draft linked" : "Created directly in Calendar"}
                {selectedPost.videoProjectId ? " · Video Studio project linked" : ""}
                {selectedPost.providerJobId ? ` · Provider job: ${selectedPost.providerJobId}` : ""}
              </p>
              {selectedPost.failureReason ? (
                <p className="mt-3 rounded-xl border border-violet-200 bg-rose-50 p-3 text-sm text-rose-700">
                  Publishing failure: {selectedPost.failureReason}
                </p>
              ) : null}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700">Workflow status</h3>
              <div className="mt-3 space-y-2">
                {[
                  ["Created", true],
                  [
                    selectedPost.entryType === "AD" ? "Human approval" : "Approval not required",
                    selectedPost.entryType === "POST" || Boolean(selectedPost.approvedAt),
                  ],
                  [
                    "Scheduled",
                    ["SCHEDULED", "PUBLISHING", "DELIVERED_TO_INBOX", "PUBLISHED", "FAILED"].includes(selectedPost.status),
                  ],
                  [
                    "Publishing started",
                    ["PUBLISHING", "DELIVERED_TO_INBOX", "PUBLISHED", "FAILED"].includes(selectedPost.status),
                  ],
                  ["Delivered to TikTok inbox", ["DELIVERED_TO_INBOX", "PUBLISHED"].includes(selectedPost.status)],
                  ["Published", selectedPost.status === "PUBLISHED"],
                ].map(([label, complete]) => (
                  <div key={String(label)} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${complete ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-700" : "border-slate-200/80 text-slate-400"}`}>
                    <span>{complete ? "✓" : "○"}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              {selectedPost.publishedAt ? <p className="mt-3 text-xs text-slate-500">Published: {new Date(selectedPost.publishedAt).toLocaleString()}</p> : null}
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
            <h3 className="font-semibold">Performance scorecard</h3>
            {!selectedScore || !selectedSnapshot ? (
              <p className="mt-2 text-sm text-slate-500">
                Score pending. Performance data will appear here after the connected channel reports results.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-[180px_1fr_auto] lg:items-center">
                <div>
                  <p className="text-4xl font-black">{selectedScore.score}<span className="text-lg text-slate-400">/100</span></p>
                  <p className="mt-1 text-sm text-slate-700">Grade {selectedScore.grade} · {selectedScore.confidence} confidence</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div><p className="text-slate-400">Engagement</p><p className="font-semibold">{percent(selectedScore.metrics.engagementRate)}</p></div>
                  <div><p className="text-slate-400">Click rate</p><p className="font-semibold">{percent(selectedScore.metrics.clickThroughRate)}</p></div>
                  <div><p className="text-slate-400">Conversion</p><p className="font-semibold">{percent(selectedScore.metrics.conversionRate)}</p></div>
                  <div><p className="text-slate-400">ROAS</p><p className="font-semibold">{selectedScore.metrics.returnOnAdSpend === null ? "N/A" : `${selectedScore.metrics.returnOnAdSpend.toFixed(2)}x`}</p></div>
                </div>
                <button
                  disabled={
                    selectedScore.score < 75 ||
                    selectedScore.confidence === "LOW" ||
                    knowledge.some((item) => item.scheduledPostId === selectedPost.id)
                  }
                  onClick={() => void addToKnowledge(selectedPost, selectedSnapshot, selectedScore)}
                  className="rounded-xl border border-emerald-500/40 px-4 py-3 text-sm text-emerald-700 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {knowledge.some((item) => item.scheduledPostId === selectedPost.id)
                    ? "In Knowledge Base ✓"
                    : "Add to Knowledge Base"}
                </button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Post and ad scorecards</h2>
            <p className="mt-1 text-sm text-slate-500">Results are organized from highest to lowest score.</p>
          </div>
          <a href="/knowledge" className="rounded-xl border border-emerald-500/40 px-4 py-2 text-sm text-emerald-700">Open Knowledge Base</a>
        </div>
        <div className="mt-4 space-y-3">
          {scorecards.length === 0 ? (
            <p className="text-slate-500">Scorecards will appear after connected channels return performance data.</p>
          ) : scorecards.map(({ post, snapshot, score }) => {
            const savedToKnowledge = knowledge.some(
              (item) => item.scheduledPostId === post.id,
            );
            return (
              <article key={post.id} className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 md:grid-cols-[90px_1fr_auto] md:items-center">
                <div>
                  <p className="text-3xl font-black">{score.score}</p>
                  <p className="text-xs text-slate-500">Grade {score.grade}</p>
                </div>
                <button onClick={() => openPost(post)} className="text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{post.title}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{post.entryType}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{score.confidence} confidence</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{post.channel} · {snapshot.impressions.toLocaleString()} impressions · {score.strengths.join(" · ")}</p>
                </button>
                <button
                  disabled={score.score < 75 || score.confidence === "LOW" || savedToKnowledge}
                  onClick={() => void addToKnowledge(post, snapshot, score)}
                  className="rounded-xl border border-emerald-500/40 px-3 py-2 text-sm text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savedToKnowledge ? "Saved winner ✓" : "Add winner"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5">
        <h2 className="text-xl font-bold">Publishing queue</h2>
        <div className="mt-4 space-y-3">
          {posts.length === 0 ? <p className="text-slate-500">Nothing scheduled yet.</p> : posts.map((post) => (
            <article key={post.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{post.title}</h3>
                  <span className={`rounded-full px-2 py-1 text-xs ${statusStyle[post.status]}`}>{post.status.replaceAll("_", " ")}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{post.entryType}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{post.channel} · {new Date(post.scheduledFor).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openPost(post)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">View details</button>
                {post.channel === "TikTok" && Boolean(post.mediaStoragePath) && ["SCHEDULED", "FAILED"].includes(post.status) ? (
                  <button disabled={working} onClick={() => void sendToTikTok(post)} className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    Send now
                  </button>
                ) : null}
                {post.channel === "TikTok" && Boolean(post.providerJobId) && ["PUBLISHING", "DELIVERED_TO_INBOX"].includes(post.status) ? (
                  <button disabled={working} onClick={() => void refreshTikTokDelivery(post)} className="rounded-xl border border-cyan-500/40 px-3 py-2 text-sm text-cyan-700 disabled:opacity-50">
                    Refresh
                  </button>
                ) : null}
                {post.status === "PENDING_APPROVAL" ? <button onClick={() => void approve(post)} className="rounded-xl border border-emerald-500/40 px-3 py-2 text-sm text-emerald-700">Approve & schedule</button> : null}
                {!["PUBLISHED", "CANCELED"].includes(post.status) ? <button onClick={() => void cancel(post)} className="rounded-xl border border-violet-200 px-3 py-2 text-sm text-rose-600">Cancel</button> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
