import { StatusBadge } from "@/components/ui/StatusBadge";

function getNodeEnv(): string {
  return process.env.NODE_ENV ?? "unknown";
}

function detectDatabaseUrl(): boolean {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

function detectOpenAI(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function detectNextAuthSecret(): boolean {
  return !!process.env.NEXTAUTH_SECRET;
}

interface EnvItem {
  label: string;
  value: string;
  variant: "active" | "inactive" | "warning" | "pending";
}

export function EnvironmentStatus() {
  const env = getNodeEnv();
  const hasDb = detectDatabaseUrl();
  const hasAI = detectOpenAI();
  const hasAuth = detectNextAuthSecret();

  const items: EnvItem[] = [
    {
      label: "Environment",
      value: env === "production" ? "Production" : env === "development" ? "Development" : "Unknown",
      variant: env === "production" ? "active" : env === "development" ? "warning" : "inactive",
    },
    {
      label: "Database",
      value: hasDb ? "Connected" : "Not configured",
      variant: hasDb ? "active" : "inactive",
    },
    {
      label: "AI Provider",
      value: hasAI ? "Configured" : "Not configured",
      variant: hasAI ? "active" : "inactive",
    },
    {
      label: "Auth Secret",
      value: hasAuth ? "Configured" : "Not configured",
      variant: hasAuth ? "active" : "inactive",
    },
  ];

  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] p-5">
      <h2 className="text-sm font-semibold text-white">Environment Status</h2>
      <p className="mt-0.5 text-xs text-zinc-500">Configuration detection</p>

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">{item.label}</span>
            <StatusBadge label={item.value} variant={item.variant} />
          </li>
        ))}
      </ul>
    </div>
  );
}
