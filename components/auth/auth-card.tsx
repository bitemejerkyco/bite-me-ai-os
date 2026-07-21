import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-md border-zinc-800 bg-zinc-950/95">
      <CardHeader>
        <p className="text-xs uppercase tracking-[0.2em] text-rose-300">{APP_NAME}</p>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <p className="text-sm text-zinc-400">{APP_TAGLINE}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
