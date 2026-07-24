type MetricCardProps = {
  label: string;
  value: string;
  accent?: "amber" | "red";
};

const accentMap: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  amber: "border-amber-500/50 text-amber-200",
  red: "border-red-500/50 text-red-200",
};

export default function MetricCard({ label, value, accent = "amber" }: MetricCardProps) {
  return (
    <div className={`rounded-xl border bg-zinc-900/80 p-4 shadow-md ${accentMap[accent]}`}>
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
