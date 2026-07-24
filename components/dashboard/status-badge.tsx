import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", {
  variants: {
    tone: {
      healthy: "bg-emerald-500/15 text-emerald-300",
      warning: "bg-amber-500/15 text-amber-300",
      offline: "bg-rose-500/15 text-rose-300",
      neutral: "bg-zinc-800 text-zinc-300",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

export function StatusBadge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof statusBadgeVariants>) {
  return <span className={cn(statusBadgeVariants({ tone }), className)} {...props} />;
}
