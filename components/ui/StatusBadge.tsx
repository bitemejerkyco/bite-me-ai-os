type StatusVariant = "active" | "inactive" | "pending" | "error" | "warning" | "success";

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
}

const variantStyles: Record<StatusVariant, string> = {
  active:   "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  success:  "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  inactive: "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20",
  pending:  "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  warning:  "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  error:    "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
};

export function StatusBadge({ label, variant = "inactive" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${variantStyles[variant]}`}
      aria-label={`Status: ${label}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
