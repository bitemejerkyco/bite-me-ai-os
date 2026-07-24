import { cn } from "@/lib/utils";

export function WizardLayout({
  title,
  description,
  step,
  totalSteps,
  children,
}: {
  title: string;
  description: string;
  step: number;
  totalSteps: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Step {step} of {totalSteps}</p>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
      </header>
      <div className="grid grid-cols-3 gap-2" aria-hidden>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div key={index} className={cn("h-1.5 rounded-full bg-zinc-800", index < step && "bg-[var(--primary)]")} />
        ))}
      </div>
      {children}
    </section>
  );
}
