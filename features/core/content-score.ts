import type {
  PerformanceSnapshot,
  ScheduledPost,
} from "@/features/core/local-os";

export type ContentScore = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  strengths: string[];
  metrics: {
    engagementRate: number;
    clickThroughRate: number;
    conversionRate: number;
    returnOnAdSpend: number | null;
  };
  version: "postmotive-score-v1";
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function targetScore(value: number, target: number): number {
  return clamp((value / target) * 100);
}

export function calculateContentScore(
  post: ScheduledPost,
  snapshot: PerformanceSnapshot,
): ContentScore {
  const impressions = Math.max(snapshot.impressions, 1);
  const audience = Math.max(snapshot.reach, snapshot.impressions, 1);
  const clicks = Math.max(snapshot.clicks, 1);
  const engagementRate = snapshot.engagements / audience;
  const clickThroughRate = snapshot.clicks / impressions;
  const conversionRate = snapshot.conversions / clicks;
  const returnOnAdSpend =
    snapshot.spend > 0 ? snapshot.revenue / snapshot.spend : null;

  const engagement = targetScore(
    engagementRate,
    post.entryType === "AD" ? 0.03 : 0.06,
  );
  const clickResponse = targetScore(
    clickThroughRate,
    post.entryType === "AD" ? 0.02 : 0.03,
  );
  const conversion = targetScore(conversionRate, 0.04);
  const delivery = post.status === "PUBLISHED" ? 100 : post.status === "FAILED" ? 0 : 50;
  const efficiency =
    returnOnAdSpend === null ? 50 : targetScore(returnOnAdSpend, 4);

  const raw =
    post.entryType === "AD"
      ? engagement * 0.15 +
        clickResponse * 0.25 +
        conversion * 0.25 +
        efficiency * 0.25 +
        delivery * 0.1
      : engagement * 0.4 +
        clickResponse * 0.3 +
        conversion * 0.2 +
        delivery * 0.1;
  const score = Math.round(clamp(raw));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const confidence =
    snapshot.impressions >= 5_000
      ? "HIGH"
      : snapshot.impressions >= 500
        ? "MEDIUM"
        : "LOW";
  const strengths: string[] = [];
  if (engagement >= 80) strengths.push("Strong engagement");
  if (clickResponse >= 80) strengths.push("Strong click response");
  if (conversion >= 80) strengths.push("Strong conversion rate");
  if (post.entryType === "AD" && efficiency >= 80) strengths.push("Efficient ad spend");
  if (!strengths.length) strengths.push("Needs more optimization data");

  return {
    score,
    grade,
    confidence,
    strengths,
    metrics: {
      engagementRate,
      clickThroughRate,
      conversionRate,
      returnOnAdSpend,
    },
    version: "postmotive-score-v1",
  };
}
