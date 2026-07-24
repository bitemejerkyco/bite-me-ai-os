interface LoadingCardProps {
  lines?: number;
}

export function LoadingCard({ lines = 3 }: LoadingCardProps) {
  return (
    <div
      className="rounded-xl border border-[#222] bg-[#161616] p-5 animate-pulse"
      aria-label="Loading…"
      role="status"
    >
      <div className="h-3 w-1/3 rounded bg-[#2a2a2a]" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="mt-3 h-3 rounded bg-[#2a2a2a]"
          style={{ width: `${80 - i * 15}%` }}
        />
      ))}
    </div>
  );
}
