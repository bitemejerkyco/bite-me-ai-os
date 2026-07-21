import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "border-[var(--border)] bg-zinc-800 text-[var(--foreground)]",
      success: "border-emerald-500/40 bg-emerald-600/15 text-emerald-300",
      warning: "border-amber-500/40 bg-amber-600/15 text-amber-300",
      danger: "border-rose-500/40 bg-rose-600/15 text-rose-300",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
