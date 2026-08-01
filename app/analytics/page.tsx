import Link from "next/link";
import AppShell from "@/components/AppShell";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";

export default function AnalyticsIndexPage() {
  return (
    <AppShell title="Analytics" eyebrow="Performance intelligence">
      <main>
        <div className="pm-glass mx-auto max-w-4xl rounded-[2rem] p-8">
          <p className="mt-3 text-slate-600">Explore channel performance dashboards using connected workspace data.</p>
          <div className="mt-6">
            <GuidedEmptyState
              title="Analytics are not available yet"
              description="Connect a marketing or analytics provider to begin collecting performance data."
              estimatedTime="3-5 minutes"
              primaryAction={{ label: "Manage Integrations", href: "/integrations" }}
              secondaryAction={{ label: "Learn About Analytics", href: "/help" }}
            />
          </div>
          <Link
            href="/analytics/amazon-ads"
            className="pm-primary-button mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold"
          >
            Open Amazon Ads Insights
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
