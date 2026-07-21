import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">{label}</CardTitle>
        <Badge variant="warning">Setup value</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-[var(--foreground)]">{value}</p>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">{detail}</p>
      </CardContent>
    </Card>
  );
}
