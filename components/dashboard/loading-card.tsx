import { Card, CardContent } from "@/components/ui/card";

export function LoadingCard({ label = "Loading" }: { label?: string }) {
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardContent className="space-y-3 p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
        <div className="h-8 w-28 animate-pulse rounded bg-zinc-800" />
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      </CardContent>
    </Card>
  );
}
