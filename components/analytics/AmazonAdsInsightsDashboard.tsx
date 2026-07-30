"use client";

import { useMemo, useState } from "react";
import DataTable from "@/components/analytics/DataTable";
import MetricCard from "@/components/analytics/MetricCard";
import TrendMiniChart from "@/components/analytics/TrendMiniChart";
import type {
  AmazonAdsDashboardViewModel,
  AmazonAdsInsightsFilter,
} from "@/features/marketing/providers/amazon-ads/insights/types";
import {
  applyDashboardFilters,
  buildCampaignRows,
  buildKeywordRows,
  buildSearchTermRows,
  buildTrendPoints,
  computeOverviewMetrics,
} from "@/features/marketing/providers/amazon-ads/insights/view-model";
import {
  filterAmazonAdsRecommendations,
  generateAmazonAdsRecommendations,
} from "@/features/marketing/providers/amazon-ads/recommendations/engine";
import type {
  AmazonAdsRecommendationFilters,
  RecommendationPriority,
} from "@/features/marketing/providers/amazon-ads/recommendations/types";

type AmazonAdsInsightsDashboardProps = {
  model: AmazonAdsDashboardViewModel;
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    value,
  );

const percent = (value: number) => `${value.toFixed(2)}%`;

const priorityClassMap: Record<RecommendationPriority, string> = {
  critical: "border-rose-300 bg-rose-50 text-rose-700",
  high: "border-orange-500/70 bg-orange-500/10 text-orange-200",
  medium: "border-amber-500/70 bg-amber-500/10 text-amber-800",
  low: "border-slate-200 bg-slate-50 text-slate-700",
};

const priorityLabel = (priority: RecommendationPriority) =>
  priority.charAt(0).toUpperCase() + priority.slice(1);

const recommendationTypeLabel = (type: string) =>
  type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function AmazonAdsInsightsDashboard({ model }: AmazonAdsInsightsDashboardProps) {
  const [activeModel, setActiveModel] = useState(model);
  const [filters, setFilters] = useState<AmazonAdsInsightsFilter>(model.filters.defaults);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [recommendationFilters, setRecommendationFilters] = useState<AmazonAdsRecommendationFilters>({
    priority: "ALL",
    type: "ALL",
    campaignId: "ALL",
    marketplaceId: "ALL",
  });

  const filtered = useMemo(() => {
    const records = applyDashboardFilters(activeModel.sourceRecords, filters);

    return {
      overview: computeOverviewMetrics(records),
      trend: buildTrendPoints(records),
      campaigns: buildCampaignRows(records),
      keywords: buildKeywordRows(records),
      searchTerms: buildSearchTermRows(records),
    };
  }, [activeModel, filters]);

  const recommendationModel = useMemo(
    () =>
      generateAmazonAdsRecommendations(
        applyDashboardFilters(activeModel.sourceRecords, filters),
        activeModel.generatedAt,
      ),
    [activeModel.generatedAt, activeModel.sourceRecords, filters],
  );

  const filteredRecommendations = useMemo(
    () => filterAmazonAdsRecommendations(recommendationModel.recommendations, recommendationFilters),
    [recommendationFilters, recommendationModel.recommendations],
  );

  const filterHint = `Filters are applied against ${activeModel.sourceMode.toLowerCase()} read-only source records.`;

  const loadLiveData = async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      const query = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      const response = await fetch(`/api/integrations/amazon-ads/insights?${query}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: AmazonAdsDashboardViewModel;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Unable to load Amazon Ads live data.");
      }
      setActiveModel(payload.data);
      setFilters(payload.data.filters.defaults);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "Unable to load Amazon Ads live data.");
    } finally {
      setLiveLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-cyan-50 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-violet-200 bg-white/80 p-6 shadow-xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800">
              {activeModel.sourceMode === "LIVE" ? "Live Amazon Data" : "Sandbox Data"}
            </span>
            <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              Read Only
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Amazon Ads Insights</h1>
          <p className="mt-2 text-sm text-slate-700">
            Workspace-isolated analytics preview for campaign, keyword, and search-term performance.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Generated: {new Date(activeModel.generatedAt).toISOString()}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadLiveData}
              disabled={liveLoading}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {liveLoading ? "Loading Amazon report…" : "Load Live Amazon Ads"}
            </button>
            <span className="text-xs text-slate-500">
              Generates a read-only Sponsored Products search-term report. No account changes are made.
            </span>
          </div>
          {liveError ? (
            <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
              {liveError}
            </p>
          ) : null}
        </header>

        <section className="grid grid-cols-1 gap-3 rounded-3xl border border-violet-200 bg-white/70 p-4 md:grid-cols-5">
          <label className="text-sm text-slate-700">
            Start Date
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
              value={filters.startDate}
              min={activeModel.filters.dateRange.min}
              max={activeModel.filters.dateRange.max}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </label>

          <label className="text-sm text-slate-700">
            End Date
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
              value={filters.endDate}
              min={activeModel.filters.dateRange.min}
              max={activeModel.filters.dateRange.max}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </label>

          <label className="text-sm text-slate-700">
            Marketplace
            <select
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
              value={filters.marketplaceId}
              onChange={(event) => setFilters((prev) => ({ ...prev, marketplaceId: event.target.value }))}
            >
              <option value="ALL">All</option>
              {activeModel.filters.marketplaces.map((marketplace) => (
                <option key={marketplace} value={marketplace}>
                  {marketplace}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Profile
            <select
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
              value={filters.profileId}
              onChange={(event) => setFilters((prev) => ({ ...prev, profileId: event.target.value }))}
            >
              <option value="ALL">All</option>
              {activeModel.filters.profiles.map((profile) => (
                <option key={profile} value={profile}>
                  {profile}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Campaign Status
            <select
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
              value={filters.campaignStatus}
              onChange={(event) => setFilters((prev) => ({ ...prev, campaignStatus: event.target.value }))}
            >
              <option value="ALL">All</option>
              {activeModel.filters.campaignStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </section>

        <p className="text-xs text-slate-500">{filterHint}</p>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="Impressions" value={filtered.overview.impressions.toLocaleString()} />
          <MetricCard label="Clicks" value={filtered.overview.clicks.toLocaleString()} />
          <MetricCard label="Spend" value={currency(filtered.overview.spend)} accent="red" />
          <MetricCard label="Sales" value={currency(filtered.overview.sales)} />
          <MetricCard label="Orders" value={filtered.overview.orders.toLocaleString()} />
          <MetricCard label="CTR" value={percent(filtered.overview.ctr)} />
          <MetricCard label="CPC" value={currency(filtered.overview.cpc)} />
          <MetricCard label="Conversion" value={percent(filtered.overview.conversionRate)} />
          <MetricCard label="ACOS" value={percent(filtered.overview.acos)} accent="red" />
          <MetricCard label="ROAS" value={`${filtered.overview.roas.toFixed(2)}x`} />
        </section>

        <TrendMiniChart data={filtered.trend} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <DataTable
            title="Campaign Performance"
            columns={["Campaign", "Type", "Status", "Budget", "Spend", "Sales", "Orders", "ACOS", "ROAS"]}
            rows={filtered.campaigns.map((row) => [
              row.campaignName,
              row.campaignType,
              row.campaignStatus,
              currency(row.budget),
              currency(row.spend),
              currency(row.sales),
              row.orders,
              percent(row.acos),
              `${row.roas.toFixed(2)}x`,
            ])}
            emptyMessage="No campaign rows for selected filters."
          />

          <DataTable
            title="Keyword Performance"
            columns={["Keyword", "Match", "Campaign", "Impr.", "Clicks", "Spend", "Orders", "Sales", "ACOS", "ROAS"]}
            rows={filtered.keywords.map((row) => [
              row.keyword,
              row.matchType,
              row.campaignName,
              row.impressions,
              row.clicks,
              currency(row.spend),
              row.orders,
              currency(row.sales),
              percent(row.acos),
              `${row.roas.toFixed(2)}x`,
            ])}
            emptyMessage="No keyword rows for selected filters."
          />
        </div>

        <DataTable
          title="Search Term Insights"
          columns={["Search Term", "Keyword", "Campaign", "Clicks", "Spend", "Orders", "Sales", "Conv.", "ACOS"]}
          rows={filtered.searchTerms.map((row) => [
            row.searchTerm,
            row.keyword,
            row.campaignName,
            row.clicks,
            currency(row.spend),
            row.orders,
            currency(row.sales),
            percent(row.conversionRate),
            percent(row.acos),
          ])}
          emptyMessage="No search term rows for selected filters."
        />

        <section className="rounded-3xl border border-violet-200 bg-white/75 p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Recommendations</h2>
              <p className="mt-1 text-sm text-slate-700">
                Deterministic, explainable guidance from sandbox performance data.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800">
              Read Only — No changes applied
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(["critical", "high", "medium", "low"] as RecommendationPriority[]).map((priority) => (
              <div key={priority} className={`rounded-2xl border p-3 ${priorityClassMap[priority]}`}>
                <p className="text-xs uppercase tracking-wide">{priorityLabel(priority)}</p>
                <p className="mt-1 text-2xl font-semibold">{recommendationModel.summary[priority]}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 md:grid-cols-4">
            <label className="text-sm text-slate-700">
              Priority
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                value={recommendationFilters.priority}
                onChange={(event) =>
                  setRecommendationFilters((prev) => ({
                    ...prev,
                    priority: event.target.value as AmazonAdsRecommendationFilters["priority"],
                  }))
                }
              >
                <option value="ALL">All</option>
                {recommendationModel.filterOptions.priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priorityLabel(priority)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Type
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                value={recommendationFilters.type}
                onChange={(event) =>
                  setRecommendationFilters((prev) => ({
                    ...prev,
                    type: event.target.value as AmazonAdsRecommendationFilters["type"],
                  }))
                }
              >
                <option value="ALL">All</option>
                {recommendationModel.filterOptions.types.map((type) => (
                  <option key={type} value={type}>
                    {recommendationTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Campaign
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                value={recommendationFilters.campaignId}
                onChange={(event) =>
                  setRecommendationFilters((prev) => ({
                    ...prev,
                    campaignId: event.target.value,
                  }))
                }
              >
                <option value="ALL">All</option>
                {recommendationModel.filterOptions.campaigns.map((campaign) => (
                  <option key={campaign.campaignId} value={campaign.campaignId}>
                    {campaign.campaignName}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Marketplace
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                value={recommendationFilters.marketplaceId}
                onChange={(event) =>
                  setRecommendationFilters((prev) => ({
                    ...prev,
                    marketplaceId: event.target.value,
                  }))
                }
              >
                <option value="ALL">All</option>
                {recommendationModel.filterOptions.marketplaces.map((marketplace) => (
                  <option key={marketplace} value={marketplace}>
                    {marketplace}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredRecommendations.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-slate-200 bg-white/60 p-4 text-sm text-slate-700">
              No recommendations for the selected filter combination.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3">
              {filteredRecommendations.map((recommendation) => (
                <article
                  key={recommendation.id}
                  className="rounded-2xl border border-slate-200 bg-white/70 p-4"
                  aria-label={`${recommendationTypeLabel(recommendation.type)} recommendation`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {recommendationTypeLabel(recommendation.type)}
                      </h3>
                      <p className="mt-1 text-sm text-slate-700">{recommendation.explanation}</p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClassMap[recommendation.priority]}`}
                    >
                      {priorityLabel(recommendation.priority)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                    <p>
                      <span className="text-slate-500">Campaign:</span>{" "}
                      {recommendation.reference.campaignName}
                    </p>
                    <p>
                      <span className="text-slate-500">Marketplace:</span>{" "}
                      {recommendation.marketplaceId}
                    </p>
                    <p>
                      <span className="text-slate-500">Confidence:</span>{" "}
                      {Math.round(recommendation.confidenceScore * 100)}%
                    </p>
                    <p>
                      <span className="text-slate-500">Impact:</span>{" "}
                      {recommendation.estimatedImpactRange.label} ({recommendation.estimatedImpactRange.low}–
                      {recommendation.estimatedImpactRange.high} {recommendation.estimatedImpactRange.unit})
                    </p>
                  </div>

                  <p className="mt-2 text-sm text-amber-800">
                    Suggested action: {recommendation.suggestedAction}
                  </p>

                  <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      View evidence
                    </summary>
                    <p className="mt-2 text-sm text-slate-700">{recommendation.calculationEvidence}</p>
                    <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-slate-700 md:grid-cols-2">
                      {Object.entries(recommendation.supportingMetrics).map(([key, value]) => (
                        <li key={`${recommendation.id}-${key}`}>
                          <span className="text-slate-500">{recommendationTypeLabel(key)}:</span> {String(value)}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate-500">{recommendation.status}</p>
                  </details>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
