import { cn } from "@/lib/utils";

export function SidebarGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <div className="space-y-1">{children}</div>
    </section>
  );
}
