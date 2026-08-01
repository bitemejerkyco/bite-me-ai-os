export type ScheduleRecommendationInput = {
  existingSlots: Array<{ scheduledFor: string; channel: string }>;
  engagementHistory: Array<{ channel: string; hourUtc: number; engagementScore: number }>;
  preferredChannels: string[];
  startDateIso: string;
  horizonDays: number;
};

export type ScheduleRecommendation = {
  channel: string;
  scheduledFor: string;
  score: number;
  reason: string;
  collision: boolean;
};

function normalizeHour(input: number): number {
  if (!Number.isFinite(input)) return 12;
  if (input < 0) return 0;
  if (input > 23) return 23;
  return Math.round(input);
}

function hashSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function bestHourForChannel(channel: string, history: ScheduleRecommendationInput["engagementHistory"]): number {
  const filtered = history.filter((row) => row.channel === channel);
  if (filtered.length === 0) return 14;
  const sorted = [...filtered].sort((a, b) => b.engagementScore - a.engagementScore);
  return normalizeHour(sorted[0]?.hourUtc ?? 14);
}

export function recommendPublishingSchedule(input: ScheduleRecommendationInput): ScheduleRecommendation[] {
  const start = new Date(input.startDateIso);
  const channels = input.preferredChannels.length > 0 ? input.preferredChannels : ["tiktok", "instagram", "email"];

  return channels.map((channel, index) => {
    const hour = bestHourForChannel(channel, input.engagementHistory);
    const offsetDays = index % Math.max(1, input.horizonDays);
    const candidate = new Date(start.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    candidate.setUTCHours(hour, (hashSeed(channel) % 2) * 15, 0, 0);

    const collision = input.existingSlots.some((slot) => {
      const slotTime = new Date(slot.scheduledFor).getTime();
      return slot.channel === channel && Math.abs(slotTime - candidate.getTime()) < 45 * 60 * 1000;
    });

    if (collision) {
      candidate.setUTCMinutes(candidate.getUTCMinutes() + 60);
    }

    const score = Math.max(0.25, Math.min(0.98, 0.5 + (hour / 24) * 0.25 + (collision ? -0.1 : 0.1)));

    return {
      channel,
      scheduledFor: candidate.toISOString(),
      score,
      reason: collision
        ? "Recommended using nearest open high-engagement slot after collision adjustment."
        : "Recommended from historical engagement peaks and open calendar capacity.",
      collision,
    };
  });
}
