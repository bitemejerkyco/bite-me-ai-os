import type { HealthStatus } from "@/features/admin/health-rules";

const statusStyles: Record<HealthStatus, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  unavailable: "border-slate-200 bg-slate-100 text-slate-600",
  not_configured: "border-slate-200 bg-white text-slate-500",
};

export default function StatusBadge({
  status,
}: {
  status: HealthStatus;
}) {
  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${statusStyles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}