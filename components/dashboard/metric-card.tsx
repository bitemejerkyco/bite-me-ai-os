import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";

export function MetricCard({
  label,
  value,
  hint,
  status,
}: {
  label: string;
  value: string;
  hint: string;
  status?: { label: string; tone: "healthy" | "warning" | "offline" | "neutral" };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">{label}</CardTitle>
        {status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : null}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">{hint}</p>
      </CardContent>
    </Card>
  );
}
