type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  appUrl: string;
  vercelUrl: string | null;
};

type ServerEnv = PublicEnv & {
  supabaseServiceRoleKey: string;
  openAiApiKey: string | null;
  openAiModel: string;
};

type EnvIssue = {
  key: string;
  guidance: string;
};

let cachedPublicEnv: PublicEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function buildConfigError(scope: string, issues: EnvIssue[]): Error {
  const details = issues.map((issue) => `${issue.key}: ${issue.guidance}`).join("; ");
  return new Error(`ENV_CONFIG_MISSING:${scope}:${details}`);
}

function readPublicEnv(): PublicEnv {
  const supabaseUrl = normalize(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = normalize(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    || normalize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const vercelUrl = normalize(process.env.VERCEL_URL) || null;
  const configuredAppUrl = normalize(process.env.NEXT_PUBLIC_APP_URL);
  const appUrl = configuredAppUrl || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000");

  const issues: EnvIssue[] = [];
  if (!supabaseUrl) {
    issues.push({
      key: "NEXT_PUBLIC_SUPABASE_URL",
      guidance: "Set the public Supabase URL for browser and server clients.",
    });
  }
  if (!publishableKey) {
    issues.push({
      key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      guidance: "Set the public Supabase publishable key used by browser and server clients.",
    });
  }
  if (issues.length > 0) {
    throw buildConfigError("public", issues);
  }

  return {
    supabaseUrl,
    supabasePublishableKey: publishableKey,
    appUrl,
    vercelUrl,
  };
}

function readServerEnv(): ServerEnv {
  const publicEnv = getPublicEnv();
  const supabaseServiceRoleKey = normalize(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseServiceRoleKey) {
    throw buildConfigError("server", [
      {
        key: "SUPABASE_SERVICE_ROLE_KEY",
        guidance: "Set the service role key for trusted server-side Supabase operations only.",
      },
    ]);
  }

  return {
    ...publicEnv,
    supabaseServiceRoleKey,
    openAiApiKey: normalize(process.env.OPENAI_API_KEY) || null,
    openAiModel: normalize(process.env.OPENAI_MODEL) || "gpt-5.6-sol",
  };
}

export function getPublicEnv(): PublicEnv {
  if (!cachedPublicEnv) {
    cachedPublicEnv = readPublicEnv();
  }
  return cachedPublicEnv;
}

export function getSupabasePublicConfig(): Pick<PublicEnv, "supabaseUrl" | "supabasePublishableKey"> {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  return { supabaseUrl, supabasePublishableKey };
}

export function getAppOrigin(): string {
  const configuredAppUrl = normalize(process.env.NEXT_PUBLIC_APP_URL);
  if (configuredAppUrl) return configuredAppUrl;

  const vercelUrl = normalize(process.env.VERCEL_URL);
  if (vercelUrl) return `https://${vercelUrl}`;

  if (process.env.NODE_ENV === "production") {
    throw buildConfigError("public", [
      {
        key: "NEXT_PUBLIC_APP_URL or VERCEL_URL",
        guidance: "Set the canonical app origin so redirects and callbacks resolve safely in production.",
      },
    ]);
  }

  return getPublicEnv().appUrl;
}

export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = readServerEnv();
  }
  return cachedServerEnv;
}

export function clearCachedEnvForTests(): void {
  cachedPublicEnv = null;
  cachedServerEnv = null;
}