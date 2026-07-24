import { cn } from "@/lib/utils";

export function Avatar({ initials = "PM", className }: { initials?: string; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-zinc-800 text-xs font-semibold text-[var(--foreground)]",
        className
      )}
      aria-label="User avatar"
    >
      {initials}
    </div>
  );
}
