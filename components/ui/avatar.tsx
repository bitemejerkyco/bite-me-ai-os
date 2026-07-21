import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  initials?: string;
};

export function Avatar({ className, initials = "AI", ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-rose-300/20 bg-rose-400/10 text-sm font-semibold text-rose-100",
        className,
      )}
      {...props}
    >
      {initials}
    </div>
  );
}
