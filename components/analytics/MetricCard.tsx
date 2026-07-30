type MetricCardProps = {
  label: string;
  value: string;
  accent?: "amber" | "red";
};

const accentMap: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  amber: "border-amber-500/50 text-amber-800",
  red: "border-rose-300 text-rose-700",
};

export default function MetricCard({ label, value, accent = "amber" }: MetricCardProps) {
  return (
    <div className={`rounded-2xl border bg-white/80 p-4 shadow-md ${accentMap[accent]}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
