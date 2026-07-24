import type { ReactNode } from "react";

interface SectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Section({ title, description, children, className = "" }: SectionProps) {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || description) && (
        <div>
          {title && (
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          )}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}
