import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-rose-500 text-white hover:bg-rose-400",
        ghost: "bg-transparent text-slate-200 hover:bg-white/10 hover:text-white",
        secondary: "bg-white/10 text-white hover:bg-white/15",
        outline: "border border-white/15 bg-transparent text-slate-100 hover:bg-white/10",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, type = "button", ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      type={type}
      {...props}
    />
  ),
);

Button.displayName = "Button";

export { Button, buttonVariants };
