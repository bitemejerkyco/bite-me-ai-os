type Snapshot = {
  channel: string;
  impressions: number;
  engagements: number;
  clicks: number;
  revenue?: number;
  hook?: string;
  cta?: string;
  postedHourUtc?: number;
};

export type PerformanceLearningSignal = {
  winners: string[];
  losers: string[];
  bestPostingHoursUtc: number[];
  strongHooks: string[];
  weakHooks: string[];
  strongCtas: string[];
  weakCtas: string[];
  notes: string[];
};

function score(row: Snapshot): number {
  const denominator = Math.max(1, row.impressions);
  const engagementRate = row.engagements / denominator;
  const clickRate = row.clicks / denominator;
  const revenueLift = Number(row.revenue || 0) > 0 ? Math.log10(1 + Number(row.revenue || 0)) / 10 : 0;
  return engagementRate * 0.45 + clickRate * 0.45 + revenueLift * 0.1;
}

function topValues(values: string[], count: number): string[] {
  const map = new Map<string, number>();
  values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) || 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map((entry) => entry[0]);
}

export function buildPerformanceLearningSignals(rows: Snapshot[]): PerformanceLearningSignal {
  if (rows.length === 0) {
    return {
      winners: [],
      losers: [],
      bestPostingHoursUtc: [],
      strongHooks: [],
      weakHooks: [],
      strongCtas: [],
      weakCtas: [],
      notes: ["No performance snapshots available yet."],
    };
  }

  const ranked = [...rows]
    .map((row) => ({ ...row, score: score(row) }))
    .sort((a, b) => b.score - a.score);

  const winnerRows = ranked.slice(0, Math.max(1, Math.floor(ranked.length / 3)));
  const loserRows = ranked.slice(-Math.max(1, Math.floor(ranked.length / 3)));

  const bestHours = winnerRows
    .map((row) => row.postedHourUtc)
    .filter((value): value is number => typeof value === "number")
    .slice(0, 5);

  return {
    winners: [...new Set(winnerRows.map((row) => row.channel))],
    losers: [...new Set(loserRows.map((row) => row.channel))],
    bestPostingHoursUtc: [...new Set(bestHours)],
    strongHooks: topValues(winnerRows.map((row) => row.hook || ""), 4),
    weakHooks: topValues(loserRows.map((row) => row.hook || ""), 4),
    strongCtas: topValues(winnerRows.map((row) => row.cta || ""), 4),
    weakCtas: topValues(loserRows.map((row) => row.cta || ""), 4),
    notes: [
      `Top-performing channels: ${[...new Set(winnerRows.map((row) => row.channel))].join(", ") || "none"}.`,
      `Underperforming channels: ${[...new Set(loserRows.map((row) => row.channel))].join(", ") || "none"}.`,
    ],
  };
}
