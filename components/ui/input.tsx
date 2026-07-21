import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => (
  <input
    className={cn(
      "flex h-11 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-rose-300/50 focus:ring-2 focus:ring-[var(--ring)]",
      className,
    )}
    ref={ref}
    type={type}
    {...props}
  />
));

Input.displayName = "Input";

export { Input };
