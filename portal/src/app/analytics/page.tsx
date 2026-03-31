"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageTransition } from "@/components/layout/PageTransition";
import { TimeRangeSelector } from "@/components/shared/TimeRangeSelector";
import { TokenTrendChart } from "@/components/analytics/TokenTrendChart";
import { SessionTrendChart } from "@/components/analytics/SessionTrendChart";
import { ModelBreakdown } from "@/components/analytics/ModelBreakdown";
import { RepoBreakdown } from "@/components/analytics/RepoBreakdown";
import { InsightsRow } from "@/components/analytics/InsightsRow";
import { useAnalytics } from "@/hooks/useAnalytics";
import { CardSkeleton } from "@/components/shared/LoadingSkeleton";
import { BarChart3 } from "lucide-react";
import type { TimeRange } from "@/types/analytics";

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [range, setRange] = useState<TimeRange>(
    (searchParams.get("range") as TimeRange) ?? "7d"
  );
  const { data, isLoading } = useAnalytics(range);

  function handleRangeChange(newRange: TimeRange) {
    setRange(newRange);
    const params = new URLSearchParams(searchParams);
    params.set("range", newRange);
    router.replace(`/analytics?${params.toString()}`);
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-accent-indigo" />
              Analytics
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Token usage, session trends, and breakdown insights
            </p>
          </div>
          <TimeRangeSelector value={range} onChange={handleRangeChange} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TokenTrendChart data={data.tokenTrend} />
              <SessionTrendChart data={data.sessionTrend} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ModelBreakdown data={data.modelBreakdown} />
              <RepoBreakdown data={data.repoBreakdown} />
            </div>
            <InsightsRow data={data.insights} />
          </>
        ) : null}
      </div>
    </PageTransition>
  );
}
