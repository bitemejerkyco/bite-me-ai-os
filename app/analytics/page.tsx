import Link from "next/link";
import AppShell from "@/components/AppShell";

export default function AnalyticsIndexPage() {
  return (
    <AppShell title="Analytics" eyebrow="Performance intelligence">
      <main>
        <div className="pm-glass mx-auto max-w-4xl rounded-[2rem] p-8">
          <p className="mt-3 text-slate-600">
            Explore channel performance dashboards in sandbox mode.
          </p>
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
