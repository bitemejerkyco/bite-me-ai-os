import { Construction } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold text-white">{title}</h1>
        <Badge variant="outline">Scaffolded</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Construction className="h-5 w-5 text-rose-300" />
            Ready for the next sprint
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-slate-300">
            Shared navigation, auth protection, and styling are in place so the feature team can
            layer in page-specific data and workflows next.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
