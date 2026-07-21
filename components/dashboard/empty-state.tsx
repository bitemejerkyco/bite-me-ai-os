import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-40 flex-col items-start justify-center gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="max-w-lg text-sm text-[var(--muted-foreground)]">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
