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

type AmazonAdsInsightsDashboardProps = {
  model: AmazonAdsDashboardViewModel;
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    value,
  );

const percent = (value: number) => `${value.toFixed(2)}%`;

export default function AmazonAdsInsightsDashboard({ model }: AmazonAdsInsightsDashboardProps) {
  const [filters, setFilters] = useState<AmazonAdsInsightsFilter>(model.filters.defaults);

  const filtered = useMemo(() => {
    const records = applyDashboardFilters(model.sourceRecords, filters);

    return {
      overview: computeOverviewMetrics(records),
      trend: buildTrendPoints(records),
      campaigns: buildCampaignRows(records),
      keywords: buildKeywordRows(records),
      searchTerms: buildSearchTermRows(records),
    };
  }, [filters, model]);

  const filterHint =
    "Filters are applied against sandbox-only source records in this read-only dashboard.";

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-red-950 px-4 py-6 text-zinc-100 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-red-500/30 bg-black/60 p-6 shadow-xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
              Sandbox Data
            </span>
            <span className="rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
              Read Only
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Amazon Ads Insights</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Workspace-isolated analytics preview for campaign, keyword, and search-term performance.
          </p>
          <p className="mt-1 text-xs text-zinc-400">Generated: {new Date(model.generatedAt).toLocaleString()}</p>
        </header>

        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-red-500/25 bg-black/50 p-4 md:grid-cols-5">
          <label className="text-sm text-zinc-300">
            Start Date
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
              value={filters.startDate}
              min={model.filters.dateRange.min}
              max={model.filters.dateRange.max}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </label>

          <label className="text-sm text-zinc-300">
            End Date
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
              value={filters.endDate}
              min={model.filters.dateRange.min}
              max={model.filters.dateRange.max}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </label>

          <label className="text-sm text-zinc-300">
            Marketplace
            <select
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
              value={filters.marketplaceId}
              onChange={(event) => setFilters((prev) => ({ ...prev, marketplaceId: event.target.value }))}
            >
              <option value="ALL">All</option>
              {model.filters.marketplaces.map((marketplace) => (
                <option key={marketplace} value={marketplace}>
                  {marketplace}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-zinc-300">
            Profile
            <select
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
              value={filters.profileId}
              onChange={(event) => setFilters((prev) => ({ ...prev, profileId: event.target.value }))}
            >
              <option value="ALL">All</option>
              {model.filters.profiles.map((profile) => (
                <option key={profile} value={profile}>
                  {profile}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-zinc-300">
            Campaign Status
            <select
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
              value={filters.campaignStatus}
              onChange={(event) => setFilters((prev) => ({ ...prev, campaignStatus: event.target.value }))}
            >
              <option value="ALL">All</option>
              {model.filters.campaignStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </section>

        <p className="text-xs text-zinc-400">{filterHint}</p>

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
      </div>
    </main>
  );
}
