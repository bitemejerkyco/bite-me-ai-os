import MetricCard from "@/components/admin/MetricCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { loadAdminOverview } from "@/features/admin/console";

function moneyLabel(cents: number | null, fallback = "Awaiting billing integration") {
  if (typeof cents !== "number") return fallback;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function AdminHomePage() {
  const overview = await loadAdminOverview();

  return (
    <div className="space-y-6">
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard eyebrow="Customers" title="Total accounts" value={String(overview.customerMetrics.totalAccounts)} detail={`${overview.customerMetrics.activeAccounts} active`} />
        <MetricCard eyebrow="Trials" title="Trial accounts" value={String(overview.customerMetrics.trialAccounts)} detail={`${overview.customerMetrics.newSignupsWeek} new signups this week`} />
        <MetricCard eyebrow="Paid" title="Paid accounts" value={String(overview.customerMetrics.paidAccounts)} detail={`${overview.customerMetrics.enterpriseAccounts} enterprise · ${overview.customerMetrics.agencyAccounts} agency`} />
        <MetricCard eyebrow="Users" title="Registered users" value={String(overview.userMetrics.totalRegisteredUsers)} detail={`${overview.userMetrics.activeUsers7Days} active in 7 days`} />
        <MetricCard eyebrow="Average" title="Users per account" value={String(overview.userMetrics.averageUsersPerAccount)} detail={`${overview.customerMetrics.suspendedAccounts} suspended accounts`} />
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard eyebrow="Revenue" title="MRR" value={moneyLabel(overview.revenueMetrics.mrrCents)} detail="Calculated only from active non-exempt plan assignments." />
        <MetricCard eyebrow="Revenue" title="ARR" value={moneyLabel(overview.revenueMetrics.arrCents)} detail="Stripe billing sync still deferred." />
        <MetricCard eyebrow="Conversion" title="Trial to paid" value="Awaiting billing integration" detail="Not fabricated without reliable subscription state." tone="warning" />
        <MetricCard eyebrow="Payments" title="Failed payments" value={String(overview.revenueMetrics.failedPayments)} detail={`${overview.revenueMetrics.billingExemptAccounts} billing-exempt accounts`} tone={overview.revenueMetrics.failedPayments > 0 ? "warning" : "default"} />
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard eyebrow="Usage" title="AI credits today" value={String(overview.usageMetrics.aiCreditsConsumedToday)} detail={`${overview.usageMetrics.aiCreditsConsumedMonth} this month`} />
        <MetricCard eyebrow="Usage" title="Video credits today" value={String(overview.usageMetrics.videoCreditsConsumedToday)} detail={`${overview.usageMetrics.videoCreditsConsumedMonth} this month`} />
        <MetricCard eyebrow="Generation" title="Generated videos" value={String(overview.usageMetrics.generatedVideos)} detail={`${overview.usageMetrics.creditsRefunded} credits refunded`} />
        <MetricCard eyebrow="Generation" title="Content generations" value={String(overview.usageMetrics.generatedImagesOrContent)} detail={`${overview.usageMetrics.failedGenerations} failed generations`} />
        <MetricCard eyebrow="Storage" title="Stored data" value={`${Math.round(overview.usageMetrics.storageUsage / 1048576)} MB`} detail={overview.usageMetrics.bandwidthUsage === null ? "Bandwidth usage unavailable" : String(overview.usageMetrics.bandwidthUsage)} tone={overview.usageMetrics.bandwidthUsage === null ? "warning" : "default"} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="pm-glass rounded-[2rem] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">System metrics</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Operations health</h2>
            </div>
            <StatusBadge status={overview.systemMetrics.health.overallStatus} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {overview.systemMetrics.health.checks.map((check) => (
              <div key={check.key} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{check.displayName}</p>
                  <StatusBadge status={check.status} />
                </div>
                <p className="mt-3 text-sm text-slate-600">{check.message}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {check.latencyMs !== null && check.latencyMs !== undefined
                    ? `${check.latencyMs} ms`
                    : "No latency available"}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="pm-glass rounded-[2rem] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Recent activity</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Incidents and audit trail</h2>
          <div className="mt-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Recent errors</h3>
              <div className="mt-3 space-y-3">
                {overview.systemMetrics.recentErrors.length > 0 ? (
                  overview.systemMetrics.recentErrors.map((error, index) => (
                    <div key={`${error.workspaceId}-${error.createdAt}-${index}`} className="rounded-[1.4rem] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                      Failed scheduled post at {new Date(error.createdAt).toLocaleString()}
                    </div>
                  ))
                ) : (
                  <p className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4 text-sm text-slate-500">No recent scheduled-post errors recorded.</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Recent audit actions</h3>
              <div className="mt-3 space-y-3">
                {overview.systemMetrics.recentAuditActions.map((entry) => (
                  <div key={String(entry.id)} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">{String(entry.action)}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(String(entry.created_at)).toLocaleString()}</p>
                    <p className="mt-2 text-sm text-slate-600">{String(entry.reason || "No reason recorded")}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}